# BoxSDK


## Overview

Sample application of **Box SDK for Node.js**.

This application demonstrate **automatic file translation** for text files under Box folder. This application use **IBM Watson Language Translator API** for language translation.


## Pre-requisites

- Box account.

- Box application settings under Box Developer.

- IBM Cloud account.

- IBM Watson Language Translator instance under IBM Cloud.


## How to setup

- Edit **settings.js** with following information:

  - exports.ClientID : Client ID for box Developers OAuth 2.0

  - exports.ClientSecret : Client Secret for box Developers OAuth 2.0

  - exports.DeveloperToken : Developer Token for box Developers

  - exports.lt_apikey : API Key for Watson Language Translator instance in IBM Cloud

  - exports.lt_url : Endpoint URL for Watson Language Translator instance in IBM Cloud(Optional. Default value is the ones of Dallas: 'https://gateway.watsonplatform.net/language-translator/api/')

  - exports.base_folder_id : Target Folder ID in box, which contains following source folder(Optional. Default value is root folder: '0')

  - exports.src_lang : Target Folder name in box, which contains one or more text files written in this language.

    - This name folder need to be existed under the ones of exports.base_folder_id, and one or more text file(s), written in this(src_lang) language, need to be existed under this folder.

  - exports.dst_lang : Target Folder name in box, which is going to be created and contains translated text files in this language.

    - This name folder can be existed before executing, but this folder need to be blank. This name folder will be created automatically when not existed.


## Reference

- Box Developer console

  - https://app.box.com/developers/console

- Box SDK for Node.js

  - https://github.com/box/box-node-sdk

- npm - IBM Watson

  - https://www.npmjs.com/package/ibm-watson


## Licensing

This code is licensed under MIT.


## Copyright

2020 [K.Kimura @ Juge.Me](https://github.com/dotnsf) all rights reserved.
