/**
 * Manager for the whole script logic	
 * @class Main
 * @singleton
 */
const LOG_TAG = '\x1b[31m' + '[upload-apperian]' + '\x1b[39;49m ';
const WEBSERVICE_URL = 'https://na01ws.apperian.com';
const SIGNING_CREDENTIALS_URL = 'https://na01ws.apperian.com/v1/credentials/';
const SIGNING_IN_PROGRESS = 'in_progress';
const SIGNING_COMPLETE = 'signed';
const SIGNING_ERROR = 'error';

const argv = require('minimist')(process.argv.slice(2));
const request = require('request');
const fs = require('fs');
const _ = require('underscore');
const Spinner = require('cli-spinner').Spinner;
const path = require('path');
const settings = require('./settings');

var main = (function () {
	'use strict';
	/**
	 * @property {String} transactionToken Token used for Apperian transactions
	 */
	var transactionToken;

	/**
	 * @property {String} METHOD_AUTHENTICATE API call to authenticate.
	 * @readonly
	 */
	var METHOD_AUTHENTICATE = '/v2/catalog/authenticate/';

	/**
	 * @property {String} METHOD_GETLIST API call to get the app list.
	 * @readonly
	 */
	var METHOD_GETLIST = '/v2/applications/';

	/**
	 * @property {String} METHOD_UPDATE API call to start the update app transaction.
	 * @readonly
	 */
	var METHOD_UPDATE = '/v1/applications/';

	/**
	 * @property {String} DEVICE_ID Device ID for the application list.
	 * @readonly
	 */
	const DEVICE_ID = '11111111-1111-1111-1111-111111111111';

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
	var deviceId = argv.deviceid || DEVICE_ID;

	/**
	 * @method executeRequest
	 * @private
	 * Executes request for Apperian
	 * @param {String} _endpoint Request to execute
	 * @param {Object} _params JSON object to send.
	 * @param {Function} _callback Function called once the method has been executed
	 * @return {void}
	 */
	function executeRequest(_endpoint, _params, _callback) {
		doLog && console.log(LOG_TAG, '- executeRequest: ' + _endpoint);
		var params = _params || {};
		var method = params.method || 'GET';
		var headers = params.headers || {};
		headers['content-type'] = 'application/json';

		request({
			url: WEBSERVICE_URL + _endpoint,
			method: method,
			headers: headers,
			json: true,
			body: params.data
		}, function (_error, _response, _body) {
			if (_error) {
				console.error(LOG_TAG, '_error: ' + JSON.stringify(_error.message, null, '\t'));
				throw new Error('Execute Method: ' + _endpoint + '. Error: ' + JSON.stringify(_error.message, null, '\t'));
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

		if (_response.token == null || _response.token === '') {
			doLog && console.error(LOG_TAG, 'Error while logging into Apperian: Token not found');
			throw new Error('Error while logging into Apperian: Token not found');
		}

		transactionToken = _response.token;
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
			uploadNewFile();
		}
	}


	/**
	 * @method uploadFile
	 * @private
	 * Uploads file to the server
	 * @return {void}
	 */
	function uploadNewFile() {
		doLog && console.log(LOG_TAG, '- uploadNewFile');
		var formData = {
			app_file: fs.createReadStream(filePath),
			data: JSON.stringify({
				author: appAuthor,
				long_description: longDescription,
				name: appName,
				short_description: shortDescription,
				version: appVersion,
				version_note: versionNotes
			})
		};
		if (doLog) {
			var spinner = new Spinner('Uploading... %s');
			spinner.start();
		}
		request.post({
			headers: {
				'X-TOKEN': transactionToken
			},
			url: WEBSERVICE_URL + METHOD_UPDATE,
			formData: formData
		}, function (_error, _httpResponse, _body) {
			doLog && spinner.stop();
			if (_error) {
				console.error('\nUpload failed:', _error);
				throw new Error('Upload failed:', _error);
			} else if (_httpResponse.statusCode == 200) {
				doLog && console.log('\nUpload successful!  Server responded with:', _body);
				signApp(_apperianId);
			}
		});
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
			headers: {
				"X-TOKEN": transactionToken
			}
		};
		executeRequest(METHOD_GETLIST, params, function (_response) {
			var type = [];
			switch (appType) {
				case 'ios':
					type.push(1); // iOS
					break;
				case 'android':
					type.push(102, 103, 104, 105, 106, 107, 108, 109); // Android
					break;
				case 'microsoft':
					type.push(401); // Windows Phone 8
					break;
				default:
					type.push(0); // Unknown
			}
			var apperianId = _.find(_response.applications, function (_app) {
				return _app.bundle_id == appId && _.indexOf(type, _app.operating_system) >= 0;
			});

			if (apperianId) {
				uploadFile(apperianId.id, apperianId.version);
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
	 * @param {Object} _apperianId Apperian application id
	 * @return {void}
	 */
	function uploadFile(_apperianId, _versionNotes) {
		doLog && console.log(LOG_TAG, '- uploadFile');
		var formData = {
			app_file: fs.createReadStream(filePath),
			data: JSON.stringify({
				author: appAuthor || _versionNotes.author,
				long_description: longDescription || _versionNotes.long_description,
				name: appName || _versionNotes.app_name,
				short_description: shortDescription || _versionNotes.short_description,
				version_num: appVersion || _versionNotes.version_num,
				version_note: versionNotes || _versionNotes.version_note
			}),
		};
		if (doLog) {
			var spinner = new Spinner('Uploading... %s');
			spinner.start();
		}
		request.post({
			headers: {
				'X-TOKEN': transactionToken
			},
			url: WEBSERVICE_URL + METHOD_UPDATE + _apperianId,
			formData: formData
		}, function (_error, _httpResponse, _body) {
			doLog && spinner.stop();
			if (_error) {
				console.error('\nUpload failed:', _error);
				throw new Error('Upload failed:', _error);
			} else if (_httpResponse.statusCode == 200) {
				doLog && console.log('\nUpload successful!  Server responded with:', _body);
				signApp(_apperianId);
			}
		});
	}

	/**
	 * @method signApp
	 * @private
	 * Gets the credential psk based on the description
	 * @param {Object} _apperianId Apperian application id
	 * @return {void}
	 */
	function signApp(_apperianId) {
		doLog && console.log(LOG_TAG, '- signApp');
		var appId = _apperianId;
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
				}
			};
			request.get(cedentialListOptions, function (_error, _httpResponse, _body) {
				var credentials = JSON.parse(_body).credentials;
				// doLog && console.log(LOG_TAG, 'Credential List: ' + JSON.stringify(credentials, null, '	'));
				var credentialPsk = _.find(credentials, function (_credential) {
					return _credential.description === sign && _credential.platform === type;
				});
				if (credentialPsk) {
					var signAppOptions = {
						url: WEBSERVICE_URL + METHOD_UPDATE + appId + '/credentials/' + credentialPsk.psk,
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
			url: WEBSERVICE_URL + METHOD_UPDATE + _appId,
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
			} else if (signStatus.signing_status === SIGNING_COMPLETE) {
				console.error(LOG_TAG, 'Application Signed: ' + signStatus.signing_status_details);
				enableApp(_appId);
			} else if (signStatus.signing_status === SIGNING_ERROR) {
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
			url: WEBSERVICE_URL + METHOD_UPDATE + _appId,
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
			doLog && console.log(LOG_TAG, 'deviceId: ' + deviceId);
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
						doLog && console.log(LOG_TAG, 'App extension incorrect for Microsoft');
						continueProcess = false;
					}
				}
			}
			if (continueProcess) {
				if (isCreate) {
					if (shortDescription == null || shortDescription == '') {
						missing = 'Short description required for new creation';
						doLog && console.log(LOG_TAG, 'Short description required for new creation');
						continueProcess = false;
					}
					if (longDescription == null || longDescription == '') {
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
					method: 'POST',
					data: {
						user_id: username,
						password: password,
						remember_me: true,
						register_catalog: false,
						device_info: {
							udid: deviceId
						}
					}
				};
				// We need to authenticate to Apperian before doing anything				
				executeRequest(METHOD_AUTHENTICATE, authenticateObject, storeToken);
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
