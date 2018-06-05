/**
 * Manager for the whole script logic	
 * @class Main
 * @singleton
 */
const LOG_TAG = '\x1b[31m' + '[upload-apperian]' + '\x1b[39;49m ';
const WEBSERVICE_URL = 'https://easesvc.apperian.com/ease.interface.php';
const ENABLE_WEBSERVICE_URL = 'https://na01ws.apperian.com/v1/applications/';
const SIGNING_CREDENTIALS_URL = 'https://na01ws.apperian.com/v1/credentials/';
const SIGNING_IN_PROGRESS = 'in_progress';
const SIGNING_COMPLETE = 'signed';
const SIGNING_ERROR = 'error';

const argv = require('minimist')(process.argv.slice(2));
const https = require('https');
const request = require('request');
const querystring = require('querystring');
const fs = require('fs');
const _ = require('underscore');
const Spinner = require('cli-spinner').Spinner;
const path = require('path');
const settings = require('./settings');

var main = (function () {
	'use strict';
	/**
	 * @property {Number} requestId=0 Request identifier for each transaction
	 */
	var requestId = 0;

	/**
	 * @property {String} transactionToken Token used for Apperian transactions
	 */
	var transactionToken;

	/**
	 * @property {String} METHOD_AUTHENTICATE API call to authenticate.
	 * @readonly
	 */
	var METHOD_AUTHENTICATE = 'com.apperian.eas.user.authenticateuser';
	/**
	 * @property {String} METHOD_GETLIST API call to get the app list.
	 * @readonly
	 */
	var METHOD_GETLIST = 'com.apperian.eas.apps.getlist';
	/**
	 * @property {String} METHOD_CREATE API call to start the create new app transaction.
	 * @readonly
	 */
	var METHOD_CREATE = 'com.apperian.eas.apps.create';
	/**
	 * @property {String} METHOD_UPDATE API call to start the update app transaction.
	 * @readonly
	 */
	var METHOD_UPDATE = 'com.apperian.eas.apps.update';
	/**
	 * @property {String} METHOD_PUBLISH API call to publish (end) the transaction.
	 * @readonly
	 */
	var METHOD_PUBLISH = 'com.apperian.eas.apps.publish';

	// +-------------------
	// | Required.
	// +-------------------
	/**
	 * @property {String} username Apperian username
	 * @property {String} password Apperian password
	 * @property {String} appId Apperian App ID
	 * @property {String} filePath File path to the compiled app
	 * @property {String} appType Application platform
	 */
	var username = argv.username || argv.u;
	var password = argv.password || argv.p;
	var appId = argv.appid || argv.i;
	var filePath = argv.filepath || argv._[0];
	var appType = argv.apptype || argv.t;

	// +-------------------
	// | Optional.
	// +-------------------
	/**
	 * @property {String} appName Apperian app name
	 * @property {String} appVersion Apperian app version
	 * @property {String} appAuthor Apperian app author
	 * @property {String} longDescription Apperian app long description
	 * @property {String} shortDescription Apperian app short description
	 * @property {String} versionNotes Apperian app version notes
	 * @property {Boolean} isCreate Set to create a new app
	 * @property {Boolean} showHelp Show help
	 * @property {String} sign Sign psk description
	 */
	var appName = argv.appname || argv.n;
	var appVersion = argv.appversion || argv.v;
	var appAuthor = argv.appauthor || argv.a;
	var longDescription = argv.longdesc || argv.l;
	var shortDescription = argv.shortdesc || argv.s;
	var versionNotes = argv.versionnotes || argv.c;
	var isCreate = argv.create;
	var showHelp = argv.h;
	var doLog = argv.dolog || settings.doLog;
	var sign = argv.sign;

	/**
	 * @method executeMethod
	 * @private
	 * Executes method for Apperian
	 * @param {String} _method Method to execute
	 * @param {Object} _params JSON object to send.
	 * @return {Object} JSON object with the result of the transaction
	 * @param {Function} _callback Function called once the method has been executed
	 */
	function executeMethod(_method, _params, _callback) {
		doLog && console.log(LOG_TAG, '- executeMethod: ' + _method);
		var rawData = '';
		var requestMessage = {
			jsonrpc: '2.0',
			apiVersion: '1.0',
			id: requestId++,
			method: _method,
			params: _params
		};

		request({
			url: WEBSERVICE_URL,
			method: 'POST',
			headers: {
				'content-type': 'application/json',
			},
			json: true,
			body: requestMessage
		}, function (_error, _response, _body)  {
			if (_error) {
				console.error(LOG_TAG, '_error: ' + JSON.stringify(_error, null, '\t'));
				throw new Error('Execute Method: ' + _method + '. Error: ' + JSON.stringify(_error, null, '\t'));
			}
			if (_body && _body.error) {
				console.error(LOG_TAG, 'Apperian error code: ' + JSON.stringify(_body.error.code, null, '\t'));
				console.error(LOG_TAG, 'Apperian error message: ' + JSON.stringify(_body.error.message, null, '\t'));
				throw new Error('Error code: ' + JSON.stringify(_body.error.code, null, '\t') + '. Error message: ' + JSON.stringify(_body.error.message,
					null, '\t'));
			}

			_callback && _callback(_body);
		});
	}

	/**
	 * @method storeToken
	 * @private
	 * Store the credentials token for future transactions
	 * @param {Object} _response Object response from authenticatication
	 * @return {void}
	 */
	function storeToken(_response) {
		doLog && console.log(LOG_TAG, '- storeToken');
		if (_response.error != null || _response.result == null) {
			doLog && console.error(LOG_TAG, 'Error while logging into Apperian: ' + JSON.stringify(_response.error, null, '\t'));
			throw new Error('Error while logging into Apperian: ' + JSON.stringify(_response.error, null, '\t'));
		}

		transactionToken = _response.result.token;
		uploadToApperian();
	}

	/**
	 * @method uploadToApperian
	 * @private
	 * Call the REST API to upload
	 * @return {void}
	 */
	function uploadToApperian() {
		if (!isCreate) {
			doLog && console.log(LOG_TAG, '- uploadToApperian - update');
			findAppId();
		} else {
			doLog && console.log(LOG_TAG, '- uploadToApperian - create');
			var params = {
				token: transactionToken
			};
			executeMethod(METHOD_CREATE, params, uploadFile);
		}
	}

	/**
	 * @method getAppId
	 * @private
	 * Finds the Apperian App Id from the App Identifier
	 * @return {void} 
	 */
	function findAppId() {
		doLog && console.log(LOG_TAG, '- getAppId');
		var params = {
			token: transactionToken
		};
		executeMethod(METHOD_GETLIST, params, function (_response) {
			var type = '';
			switch (appType) {
			case 'ios':
				type = 'IPA';
				break;
			case 'android':
				type = 'APK';
				break;
			case 'microsoft':
				type = 'APPX';
				break;
			default:
			}
			var apperianId = _.find(_response.result.applications, function (_app) {
				return _app.bundleId == appId && _app.type.indexOf(type) >= 0;
			});
			if (apperianId) {
				params.appID = apperianId.ID;
				executeMethod(METHOD_UPDATE, params, uploadFile);
			} else {
				console.error(LOG_TAG, 'Application not found in Apperian.');
				throw new Error('Application not found in Apperian.');
			}
		});

	}

	/**
	 * @method uploadFile
	 * @private
	 * Uploads file to the server
	 * @param {Object} _response Response from the create or upload transaction
	 * @return {void}
	 */
	function uploadFile(_response) {
		doLog && console.log(LOG_TAG, '- uploadFile');
		var fileUrl = _response.result.fileUploadURL;
		var formData = {
			LUuploadFile: fs.createReadStream(filePath)
		};
		if (doLog) {
			var spinner = new Spinner('Uploading... %s');
			spinner.start();
		}
		request.post({
			url: fileUrl,
			formData: formData
		}, function (_error, _httpResponse, _body) {
			doLog && spinner.stop();
			if (_error) {
				console.error('\nUpload failed:', _error);
				throw new Error('Upload failed:', _error);
			} else if (_httpResponse.statusCode == 200) {
				doLog && console.log('\nUpload successful!  Server responded with:', _body);
				var fileId = JSON.parse(_body).fileID;
				publishToApperian(_response.result, fileId);
			}
		});
	}

	/**
	 * @method publishToApperian
	 * @private
	 * Publish the app to Apperian
	 * @param {Object} _response Response from the file uploaded
	 * @param {String} _fileId Identifier of the uploaded file
	 * @return {void}
	 */
	function publishToApperian(_response, _fileId) {
		doLog && console.log(LOG_TAG, '- publishToApperian');
		var params = {
			token: transactionToken,
			transactionID: _response.transactionID,
			EASEmetadata: {
				author: appAuthor || _response.EASEmetadata.author,
				longdescription: longDescription || _response.EASEmetadata.longdescription,
				name: appName || _response.EASEmetadata.name,
				shortdescription: shortDescription || _response.EASEmetadata.shortdescription,
				version: appVersion || _response.EASEmetadata.version,
				versionNotes: versionNotes || _response.EASEmetadata.versionNotes
			},
			files: {
				application: _fileId
			}
		};
		executeMethod(METHOD_PUBLISH, params, signApp);
	}

	/**
	 * @method signApp
	 * @private
	 * Gets the credential psk based on the description
	 * @param {Object} _response Response from the app Publish
	 * @return {void}
	 */
	function signApp(_response) {
		doLog && console.log(LOG_TAG, '- signApp');
		var appId = _response.result.appID;
		if (!sign || sign === '') {
			enableApp(appId);
		} else {
			var type = 0;
			switch (appType) {
			case 'ios':
				type = 1;
				break;
			case 'android':
				type = 2;
				break;
			default:
			}
			var cedentialListOptions = {
				url: SIGNING_CREDENTIALS_URL,
				headers: {
					'X-TOKEN': transactionToken,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					enabled: true
				})
			};
			request.get(cedentialListOptions, function (_error, _httpResponse, _body) {
				var credentials = JSON.parse(_body).credentials;
				// doLog && console.log(LOG_TAG, 'Credential List: ' + JSON.stringify(credentials, null, '	'));
				var credentialPsk = _.find(credentials, function (_credential) {
					return _credential.description === sign && _credential.platform === type;
				});
				if (credentialPsk) {
					var signAppOptions = {
						url: ENABLE_WEBSERVICE_URL + appId + '/credentials/' + credentialPsk.psk,
						headers: {
							'X-TOKEN': transactionToken,
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							enabled: true
						})
					};
					request.put(signAppOptions, function (_errorSign, _httpResponseSign, _bodySign) {
						var body = JSON.parse(_bodySign);
						if (body.error) {
							console.error(LOG_TAG, 'Error signing App: ' + body.error.message);
							throw new Error('Error signing App: ' + body.error.message);
						} else if (body.signing_status === SIGNING_IN_PROGRESS) {
							checkSignStatus(appId);
						}
					});				
				} else {
					console.error(LOG_TAG, 'Credential not found in Apperian.');
					throw new Error('Credential not found in Apperian.');
				}
			});
		}
	}

	/**
	 * @method checkSignStatus
	 * @private
	 * Checks the status of the 
	 * @param {String} _appId Application ID
	 * @return {void}
	 */
	function checkSignStatus(_appId) {
		doLog && console.log(LOG_TAG, '- checkSignStatus');		
		var checkSignOptions = {
			url: ENABLE_WEBSERVICE_URL + _appId,
			headers: {
				'X-TOKEN': transactionToken,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				enabled: true
			})
		};
		request.get(checkSignOptions, function (_error, _httpResponse, _body) {
			var signStatus = JSON.parse(_body).application.version;
			if (signStatus.signing_status === SIGNING_IN_PROGRESS) {
				console.log(LOG_TAG, 'Application signing status: ' + signStatus.signing_status_details);
				_.delay(checkSignStatus, 5000, _appId);
			} else if (signStatus.signing_status === SIGNING_COMPLETE){
				console.error(LOG_TAG, 'Application Signed: ' + signStatus.signing_status_details);
				enableApp(_appId);
			} else if (signStatus.signing_status === SIGNING_ERROR){
				console.error(LOG_TAG, 'Error signing application: ' + signStatus.signing_status_details);
				throw new Error('Error signing application: ' + signStatus.signing_status_details);
			}
		});
	}
	
	/**
	 * @method enableApp
	 * @private
	 * Enables the app on Apperian
	 * @param {String} _appId Application ID
	 * @return {void}
	 */
	function enableApp(_appId) {
		doLog && console.log('Published successfully!');
		doLog && console.log(LOG_TAG, '- enableApp');
		var putOptions = {
			url: ENABLE_WEBSERVICE_URL + _appId,
			headers: {
				'X-TOKEN': transactionToken,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				enabled: true
			})
		};
		request.put(putOptions, function (_error, _httpResponse, _body) {
			doLog && console.log(LOG_TAG, 'Enabling Response: ' + _body);
		});
	}

	/**
	 * @method uploadApperian
	 * @private
	 * description
	 * @param {Object} _params param_description
	 * REQUIRED
	 * @property {String} _params.username Apperian username
	 * @property {String} _params.password Apperian password
	 * @property {String} _params.appId Apperian App ID
	 * @property {String} _params.filePath File path to the compiled app
	 * @property {String} _params.appType Application platform
	 * OPTIONAL
	 * @property {String} _params.appName Apperian app name
	 * @property {String} _params.appVersion Apperian app version
	 * @property {String} _params.appAuthor Apperian app author
	 * @property {String} _params.longDescription Apperian app long description
	 * @property {String} _params.shortDescription Apperian app short description
	 * @property {String} _params.versionNotes Apperian app version notes
	 * @property {Boolean} _params.isCreate Set to create a new app
	 * @property {Boolean} _params.showHelp Show help
	 * @property {String} sign Sign psk description
	 * @return {void}
	 */
	function uploadApperian(_params) {
		_params = _params || {};
		username = _params.username;
		password = _params.password;
		appId = _params.appId;
		filePath = _params.filePath;
		appType = _params.appType;
		appName = _params.appName;
		appVersion = _params.appVersion;
		appAuthor = _params.appAuthor;
		longDescription = _params.longDesc;
		shortDescription = _params.shortDesc;
		versionNotes = _params.versionNotes;
		isCreate = _params.create;
		doLog = _params.dolog || settings.doLog;
		showHelp = _params.showHelp;
		sign = _params.sign;
		start();
	}

	/**
	 * @method start
	 * Called once the script has started
	 * @return {void}
	 */
	function start() {
		const cwd = process.cwd();
		var missing = '';
		if (showHelp) {
			doLog = true;
			fs.readFile('./lib/help.txt', 'utf8', function (err, data) {
				doLog && console.log(data);
			});
		} else {
			doLog && console.log(LOG_TAG, '- start');
			var continueProcess = true;

			doLog && console.log(LOG_TAG, 'username: ' + username);
			doLog && console.log(LOG_TAG, 'appId: ' + appId);
			doLog && console.log(LOG_TAG, 'filePath: ' + filePath);
			doLog && console.log(LOG_TAG, 'appName: ' + appName);
			doLog && console.log(LOG_TAG, 'appVersion: ' + appVersion);
			doLog && console.log(LOG_TAG, 'appType: ' + appType);
			doLog && console.log(LOG_TAG, 'appAuthor: ' + appAuthor);
			doLog && console.log(LOG_TAG, 'longDescription: ' + longDescription);
			doLog && console.log(LOG_TAG, 'shortDescription: ' + shortDescription);
			doLog && console.log(LOG_TAG, 'versionNotes: ' + versionNotes);
			doLog && console.log(LOG_TAG, 'sign: ' + sign);
			if (!username) {
				missing = 'Missing --username flag';
				doLog && console.log(LOG_TAG, 'Missing --username flag');
				continueProcess = false;
			}
			if (!password && continueProcess) {
				missing = 'Missing --password flag';
				doLog && console.log(LOG_TAG, 'Missing --password flag');
				continueProcess = false;
			}
			if (!appId && continueProcess) {
				missing = 'Missing --appId flag';
				doLog && console.log(LOG_TAG, 'Missing --appId flag');
				continueProcess = false;
			}
			if (!appType && continueProcess) {
				missing = 'Missing --appType flag';
				doLog && console.log(LOG_TAG, 'Missing --appType flag');
				continueProcess = false;
			} else if (continueProcess) {
				appType = appType.toLowerCase();
				doLog && console.log(LOG_TAG, 'appType: ' + appType);
				if (appType !== 'ios' && appType !== 'android' && appType !== 'microsoft') {
					missing = 'App Type not supported';
					doLog && console.log(LOG_TAG, 'App Type not supported');
					continueProcess = false;
				}
			}
			if ((!filePath || filePath == '') && continueProcess) {
				missing = 'Missing the file path';
				doLog && console.log(LOG_TAG, 'Missing the file path');
				continueProcess = false;
			} else if (continueProcess) {
				if (!path.isAbsolute(filePath)) {
					filePath = path.join(cwd, filePath);
				}

				if (!fs.existsSync(filePath)) {
					missing = 'App file not found';
					doLog && console.log(LOG_TAG, 'App file not found');
					continueProcess = false;
				} else if (appType === 'ios') {
					if (path.extname(filePath) != '.ipa') {
						missing = 'App extension incorrect for iOS';
						doLog && console.log(LOG_TAG, 'App extension incorrect for iOS');
						continueProcess = false;
					}
				} else if (appType === 'android') {
					if (path.extname(filePath) != '.apk') {
						missing = 'App extension incorrect for Android';
						doLog && console.log(LOG_TAG, 'App extension incorrect for Android');
						continueProcess = false;
					}
				} else if (appType === 'microsoft') {
					if (path.extname(filePath) != '.appx') {
						missing = 'App extension incorrect for Microsoft';
						doLog && console.log(LOG_TAG, 'App extension incorrect for Mircrosft');
						continueProcess = false;
					}
				}
			}
			if (continueProcess) {
				if(isCreate) {
					if (shortDescription == null || shortDescription == '') {
						missing = 'Short description required for new creation';
						doLog && console.log(LOG_TAG, 'Short description required for new creation');
						continueProcess = false;
					} 
					if (longDescription == null || longDescription == ''){
						missing = 'Long description required for new creation';
						doLog && console.log(LOG_TAG, 'Long description required for new creation');
						continueProcess = false;

					} 
					if (appName == null || appName == '') {
						missing = 'App name required for new creation';
						doLog && console.log(LOG_TAG, 'App name required for new creation');
						continueProcess = false;

					} 
					if (appAuthor == null || appAuthor == '') {
						missing = 'App author required for new creation';
						doLog && console.log(LOG_TAG, 'App author required for new creation');
						continueProcess = false;

					}
					if (appVersion == null || appVersion == '') {
						missing = 'App version required for new creation';
						doLog && console.log(LOG_TAG, 'App version required for new creation');
						continueProcess = false;

					}
					if (versionNotes == null || versionNotes == '') {
						missing = 'Version notes required for new creation';
						doLog && console.log(LOG_TAG, 'Version notes required for new creation');
						continueProcess = false;

					}
				}
			}
			if (continueProcess) {
				var authenticateObject = {
					email: username,
					password: password
				};
				// We need to authenticate to Apperian before doing anything				
				executeMethod(METHOD_AUTHENTICATE, authenticateObject, storeToken);
			} else {
				throw new Error(missing);
			}
		}
	}

	return {
		start: start,
		uploadApperian: uploadApperian
	};
})();

module.exports = main;
