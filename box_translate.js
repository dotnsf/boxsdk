//. upload.js
//. https://github.com/box/box-node-sdk
var fs = require( 'fs' );
var ltv3 = require( 'ibm-watson/language-translator/v3' );
var { IamAuthenticator } = require( 'ibm-watson/auth' );
var BoxSDK = require( 'box-node-sdk' );
var settings = require( './settings' );

var lt = null;
if( settings.lt_apikey ){
  var lt_url = ( settings.lt_url ? settings.lt_url : 'https://gateway.watsonplatform.net/language-translator/api/' );
  lt = new ltv3({
    authenticator: new IamAuthenticator( { apikey: settings.lt_apikey } ),
    version: '2018-05-01',
    url: lt_url
  });
}

var sdk = new BoxSDK({
  clientID: settings.ClientID,
  clientSecret: settings.ClientSecret
});

var client = sdk.getBasicClient( settings.DeveloperToken );

var folder_id = settings.base_folder_id;  //. /api/
var src_lang = settings.src_lang;
var dst_lang = settings.dst_lang;

if( folder_id && src_lang && dst_lang ){
  client.folders.get( folder_id )
  .then( folder => {
    var src_folder_id = null;
    var dst_folder_id = null;
    folder.item_collection.entries.forEach( entry => {
      if( entry.type == 'folder' && entry.name == src_lang ){
        src_folder_id = entry.id;
      }else if( entry.type == 'folder' && entry.name == dst_lang ){
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
          //. 対象は拡張子 .txt のテキストファイル
          if( entry.type == 'file' && entry.name.toLowerCase().endsWith( '.txt' ) ){
            client.files.getReadStream( entry.id, null, async function( err, stream1 ){
              if( err ){
                console.log( err );
              }else{
                //. ダウンロードファイル名
                var downloadfilename = './tmp/' + entry.name;

                //. アップロードファイル名
                var uploadfilename = './tmp/' + dst_lang + '-' + entry.name;

                //. テキストファイルをダウンロード
                var out = fs.createWriteStream( downloadfilename );
                stream1.pipe( out );  //. <- 非同期？
                stream1.on( 'end', async function(){
                  //. テキストファイルの内容を読み取り
                  var src_text = fs.readFileSync( downloadfilename, { encoding: "utf-8" } );

                  //. 翻訳
                  var dst_text = await translate( src_text, src_lang, dst_lang );
                  fs.unlink( downloadfilename );

                  //. 翻訳結果をファイルとして書き込み
                  fs.writeFileSync( uploadfilename, dst_text )

                  //. 翻訳結果をアップロード
                  var stream2 = fs.createReadStream( uploadfilename );
                  client.files.uploadFile( dst_folder_id, entry.name, stream2 )
                  .then( file => {
                    fs.unlink( uploadfilename );
                    //console.log( JSON.stringify( file, null, 2 ) );
                  })
                  .catch( err => {
                    fs.unlink( uploadfilename );
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

async function translate( text, src, dst ){
  return new Promise( async function( resolve, reject ){
    if( text ){
      if( src == 'en' || dst == 'en' ){
        var data = { text: text, source: src, target: dst };
        lt.translate( data, async function( err, translations ){
          if( err ){
            resolve( err );
          }else{
            if( translations && translations.result && translations.result.translations ){
              resolve( translations.result.translations[0].translation );
            }else{
              resolve( null );
            }
          }
        });
      }else{
        var data1 = { text: text, source: src, target: 'en' };
        lt.translate( data1, async function( err, translations1 ){
          if( err ){
            resolve( err );
          }else{
            if( translations1 && translations1.result && translations1.result.translations && translations1.result.translations.length > 0 ){
              var data2 = { text: translations1.result.translations[0].translation, source: 'en', target: dst };
              lt.translate( data2, async function( err, translations2 ){
                if( err ){
                  resolve( err );
                }else{
                  if( translations2 && translations2.result && translations2.result.translations ){
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
