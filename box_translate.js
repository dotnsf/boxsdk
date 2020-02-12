//. box_translate.js
//. https://github.com/box/box-node-sdk
var fs = require( 'fs' );
var ltv3 = require( 'ibm-watson/language-translator/v3' );
var { IamAuthenticator } = require( 'ibm-watson/auth' );
var BoxSDK = require( 'box-node-sdk' );
var settings = require( './settings' );

//. IBM Watson Language Translator V3 の初期化
var lt = null;
if( settings.lt_apikey ){
  var lt_url = ( settings.lt_url ? settings.lt_url : 'https://gateway.watsonplatform.net/language-translator/api/' );
  lt = new ltv3({
    authenticator: new IamAuthenticator( { apikey: settings.lt_apikey } ),
    version: '2018-05-01',
    url: lt_url
  });
}

//. DeveloperToken を使った Box SDK Basic Client の初期化
var sdk = new BoxSDK({
  clientID: settings.ClientID,
  clientSecret: settings.ClientSecret
});

var client = sdk.getBasicClient( settings.DeveloperToken );

//. settings.js の設定内容を反映
var folder_id = settings.base_folder_id;
var src_lang = settings.src_lang;
var dst_lang = settings.dst_lang;

//. すべて指定されている場合に以下を実行
if( folder_id && src_lang && dst_lang ){
  //. 指定されたフォルダを読み取って、翻訳対象フォルダの id を見つける
  client.folders.get( folder_id )
  .then( folder => {
    var src_folder_id = null;
    var dst_folder_id = null;
    folder.item_collection.entries.forEach( entry => {
      if( entry.type == 'folder' && entry.name == src_lang ){
        //. 翻訳元フォルダが見つかった
        src_folder_id = entry.id;
      }else if( entry.type == 'folder' && entry.name == dst_lang ){
        //. 翻訳先フォルダが見つかった
        dst_folder_id = entry.id;
      }
    });

    if( !src_folder_id ){
      console.log( 'No folder "' + src_lang + '" found.' );
    }else{
      //. 翻訳先フォルダが存在していなかったら作成する
      if( !dst_folder_id ){
        client.folders.create( folder_id, dst_lang )
        .then( folder => {
          dst_folder_id = folder.id;
        })
        .catch( err => console.log( err ) );
      }

      //. 翻訳前フォルダを読み取り
      client.folders.get( src_folder_id )
      .then( folder => {
        folder.item_collection.entries.forEach( entry => {
          //. 拡張子 .txt のテキストファイルを対象にすべてダウンロードする
          if( entry.type == 'file' && entry.name.toLowerCase().endsWith( '.txt' ) ){
            client.files.getReadStream( entry.id, null, async function( err, stream1 ){
              if( err ){
                console.log( err );
              }else{
                //. ダウンロードファイル名は元のまま
                var downloadfilename = './tmp/' + entry.name;

                //. アップロードファイル（翻訳後）名はダウンロードファイル名の頭に翻訳先言語をつける
                var uploadfilename = './tmp/' + dst_lang + '-' + entry.name;

                //. テキストファイルをダウンロード
                var out = fs.createWriteStream( downloadfilename );
                stream1.pipe( out );
                stream1.on( 'end', async function(){
                  //. ダウンロードが完了したら、テキストファイルの内容を読み取り
                  var src_text = fs.readFileSync( downloadfilename, { encoding: "utf-8" } );

                  //. IBM Watson Language Translator で同期的に翻訳
                  var dst_text = await translate( src_text, src_lang, dst_lang );
                  fs.unlink( downloadfilename );  //. この時点で翻訳元ファイルは不要（削除）

                  //. 翻訳結果をアップロードファイルとして書き込み
                  fs.writeFileSync( uploadfilename, dst_text )

                  //. 翻訳結果を Box にアップロード
                  var stream2 = fs.createReadStream( uploadfilename );
                  client.files.uploadFile( dst_folder_id, entry.name, stream2 ) //. ファイル名は元のまま
                  .then( file => {
                    fs.unlink( uploadfilename );  //. 翻訳先ファイルも削除
                    //console.log( JSON.stringify( file, null, 2 ) );
                  })
                  .catch( err => {
                    fs.unlink( uploadfilename );  //. アップロードに失敗した場合も翻訳先ファイルは削除
                    console.log( err )
                  });
                });
              }
            });
          }
        });
      })
      .catch( err => {
        console.log( err );
      });
    }
  })
  .catch( err => console.log( err ) );
}

//. IBM Watson Lanuguage Translator で src 言語のテキスト text を dst 言語に同期的に翻訳する
async function translate( text, src, dst ){
  return new Promise( async function( resolve, reject ){  //. 同期処理
    if( text ){
      if( src == 'en' || dst == 'en' ){
        //. 翻訳前または翻訳後の言語が英語の場合は直接翻訳する
        var data = { text: text, source: src, target: dst };
        lt.translate( data, async function( err, translations ){
          if( err ){
            resolve( err );
          }else{
            if( translations && translations.result && translations.result.translations ){
              //. 翻訳結果の第一候補を取り出して翻訳結果とする
              resolve( translations.result.translations[0].translation );
            }else{
              resolve( null );
            }
          }
        });
      }else{
        //. 翻訳前、翻訳後の言語がいずれも英語以外の場合は（直接翻訳する機能がないので）一度英訳してから目的言語に再訳する
        var data1 = { text: text, source: src, target: 'en' };
        lt.translate( data1, async function( err, translations1 ){
          if( err ){
            resolve( err );
          }else{
            if( translations1 && translations1.result && translations1.result.translations && translations1.result.translations.length > 0 ){
              //. 英訳した結果を目的言語に再翻訳する
              var data2 = { text: translations1.result.translations[0].translation, source: 'en', target: dst };
              lt.translate( data2, async function( err, translations2 ){
                if( err ){
                  resolve( err );
                }else{
                  if( translations2 && translations2.result && translations2.result.translations ){
                    //. 翻訳結果の第一候補を取り出して翻訳結果とする
                    resolve( translations2.result.translations[0].translation );
                  }else{
                    resolve( null );
                  }
                }
              });
            }else{
              resolve( null );
            }
          }
        });
      }
    }else{
      resolve( null );
    }
  });
}
