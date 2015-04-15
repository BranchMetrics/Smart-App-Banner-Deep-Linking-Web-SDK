/***
 * This file provides the main Branch function.
 */

goog.provide('Branch');
goog.require('utils');
goog.require('resources');
goog.require('Server');
goog.require('banner');
goog.require('Queue');
goog.require('storage');
goog.require('config');
goog.require('goog.json'); // jshint unused:false

if (utils.CORDOVA_BUILD) { var exec = require("cordova/exec"); } // jshint ignore:line

var default_branch;

/***
 * @param {Error} err
 * @param {function(?Error,?=)=} callback
 */
function wrapError(err, callback) {
	if (callback) { return callback(err); }
	throw err;
}

/***
 * @param {function(?)} func
 * @param {function(?Error,?=)=} callback
 */
function wrapErrorFunc(func, callback) {
	return function(err, data) {
		if (err && callback) { callback(err); }
		else if (err) { throw err; }
		else if (func) { func(data); }
	};
}

/***
 * @param {function(?Error)=} callback
 * @returns {function(?Error)}
 */
function wrapErrorCallback1(callback) {
	return function(err) {
		if (err && !callback) { throw err; }
		if (callback) { callback(err); }
	};
}

/***
 * @param {function(?Error,?)=} callback
 * @returns {function(?Error,?=)}
 */
function wrapErrorCallback2(callback) {
	/*** @type {function(?Error,?=)} */
	var r = function(err, data) {
		if (err && !callback) { throw err; }
		if (callback) { callback(err, data); }
	};
	return r;
}

/***
 * @class Branch
 * @constructor
 */
Branch = function() {
	if (!(this instanceof Branch)) {
		if (!default_branch) { default_branch = new Branch(); }
		return default_branch;
	}
	this._queue = Queue();
	this._storage = storage(false);
	this._server = new Server();

	if (utils.CORDOVA_BUILD) {
		this._permStorage = storage(true);  // For storing data we need from run to run such as device_fingerprint_id and
											// the session params from the first install.
		this.sdk = "cordova" + config.version;  // For mobile apps, we send the SDK version string that generated the request.
		this.debug = false;					// A debug install session will get a unique device id.
	}

	this.initialized = false;
};

/***
 * @param {utils.resource} resource
 * @param {Object.<string, *>} obj
 * @param {function(?Error,?)=} callback
 */
Branch.prototype._api = function(resource, obj, callback) {
	var self = this;
		this._queue(function(next) {
		if (((resource.params && resource.params['app_id']) || (resource.queryPart && resource.queryPart['app_id'])) && self.app_id) { obj['app_id'] = self.app_id; }
		if (((resource.params && resource.params['session_id']) || (resource.queryPart && resource.queryPart['session_id'])) && self.session_id) { obj['session_id'] = self.session_id; }
		if (((resource.params && resource.params['identity_id']) || (resource.queryPart && resource.queryPart['identity_id'])) && self.identity_id) { obj['identity_id'] = self.identity_id; }

		// These three are sent from mobile apps
		if (utils.CORDOVA_BUILD) {
			if (((resource.params && resource.params['device_fingerprint_id']) || (resource.queryPart && resource.queryPart['device_fingerprint_id'])) && self.device_fingerprint_id) { obj['device_fingerprint_id'] = self.device_fingerprint_id; }
			if (((resource.params && resource.params['link_click_id']) || (resource.queryPart && resource.queryPart['link_click_id'])) && self.link_click_id) { obj['link_click_id'] = self.link_click_id; }
			if (((resource.params && resource.params['sdk']) || (resource.queryPart && resource.queryPart['sdk'])) && self.sdk) { obj['sdk'] = self.sdk; }
		}

		return self._server.request(resource, obj, self._storage, function(err, data) {
			next();
			callback(err, data);
		});
	});
};

if (utils.CORDOVA_BUILD) {
/**
 * @function Branch.setDebug
 * @param {boolean} debug - _required_ - Set the SDK debug flag.
 *
 * Setting the SDK debug flag will generate a new device ID each time the app is installed
 * instead of possibly using the same device id.  This is useful when testing.
 *
 * This needs to be set before the Branch.init call!!!
 *
 * THIS METHOD IS CURRENTLY ONLY AVAILABLE IN THE CORDOVA/PHONEGAP PLUGIN
 *
 * ---
 *
 */
	Branch.prototype['setDebug'] = function(debug) {
		this.debug = debug;
	};
}

/**
 * @function Branch.init
 * @param {string} app_id - _required_ - Your Branch [app key](http://dashboard.branch.io/settings).
 * @param {function(?Error, utils.sessionData=)=} callback - _optional_ - callback to read the session data.
 * @param {boolean} isReferrable - _optional_ - Is this a referrable session.
 *
 * THE "isReferrable" PARAM IS ONLY USED IN THE CORDOVA/PHONEGAP PLUGIN
 *
 * Adding the Branch script to your page automatically creates a window.branch
 * object with all the external methods described below. All calls made to
 * Branch methods are stored in a queue, so even if the SDK is not fully
 * instantiated, calls made to it will be queued in the order they were
 * originally called.
 *
 * The init function on the Branch object initiates the Branch session and
 * creates a new user session, if it doesn't already exist, in
 * `sessionStorage`.
 *
 * **Useful Tip**: The init function returns a data object where you can read
 * the link the user was referred by.
 *
 * ##### Usage
 * ```js
 * branch.init(
 *     app_id,
 *     callback (err, data),
 *     is_referrable
 * );
 * ```
 *
 * ##### Callback Format
 * ```js
 * callback(
 *      "Error message",
 *      {
 *           data:               { },      // If the user was referred from a link, and the link has associated data, the data is passed in here.
 *           referring_identity: '12345', // If the user was referred from a link, and the link was created by a user with an identity, that identity is here.
 *           has_app:            true,    // Does the user have the app installed already?
 *           identity:       'BranchUser' // Unique string that identifies the user
 *      }
 * );
 * ```
 *
 * **Note:** `Branch.init` must be called prior to calling any other Branch functions.
 * ___
 */
Branch.prototype['init'] = function(app_id, callback, isReferrable) {
	if (this.initialized) { return wrapError(new Error(utils.message(utils.messages.existingInit)), callback); }

	this.app_id = app_id;
	var self = this,
		sessionData = utils.readStore(this._storage);

	function setBranchValuesCordova(data) {
		self.session_id = data['session_id'];
		self.identity_id = data['identity_id'];
		self.sessionLink = data['link'];
		self.device_fingerprint_id = data['device_fingerprint_id'];
		self.link_click_id = data['link_click_id'];
		self.initialized = true;
	}
	function setBranchValuesWeb(data) {
		self.session_id = data['session_id'];
		self.identity_id = data['identity_id'];
		self.sessionLink = data['link'];
		self.initialized = true;
	}

	if (sessionData  && sessionData['session_id']) {
		if (utils.CORDOVA_BUILD) {
			setBranchValuesCordova(sessionData);
		}
		if (utils.WEB_BUILD) {
			setBranchValuesWeb(sessionData);
		}
		if (callback) { callback(null, utils.whiteListSessionData(sessionData)); }
	}
	else {
		if (utils.CORDOVA_BUILD) {
			var args = [];
			// If we have a stored identity_id this is not a new install so call open.  Otherwise call install.
			if (utils.readKeyValue('identity_id', self._permStorage)) {
				self.identity_id = utils.readKeyValue('identity_id', self._permStorage);
				self.device_fingerprint_id = utils.readKeyValue('device_fingerprint_id', self._permStorage);
				if (typeof isReferrable !== "undefined" && isReferrable !== null) {
					args.push(isReferrable ? 1 : 0);
				}
				exec(function(data) {
					console.log("Sending open with: " + goog.json.serialize(data));
					self._api(resources.open, data, wrapErrorFunc(function(data) {
						console.log("Open successful: " + data);
						setBranchValuesCordova(data);
						utils.storeKeyValue('identity_id', data.identity_id, self._permStorage);
						utils.storeKeyValue('device_fingerprint_id', data.device_fingerprint_id, self._permStorage);
						utils.store(data, self._storage);
						if (callback) { callback(null, data); }
					}, callback));
				},
				function() {
					if (callback) {
						callback(new Error("Error getting device data!"));
					}
				},  "BranchDevice", "getOpenData", args);
			}
			else {
				args.push(self.debug);
				if ((typeof isReferrable !== "undefined") && (isReferrable !== null)) {
					args.push(isReferrable ? 1 : 0);
				}
				exec(function(data) {
					console.log("Sending install with: " + goog.json.serialize(data));
					self._api(resources.install, data, wrapErrorFunc(function(data) {
						console.log("Install successful: " + data);
						setBranchValuesCordova(data);
						utils.store(data, self._storage);
						utils.store(data, self._permStorage);
						if (callback) { callback(null, data); }
					}, callback));
				},
				function() {
					if (callback) {
						callback(new Error("Error getting device data!"));
					}
				},  "BranchDevice", "getInstallData", args);
			}
		}

		if (utils.WEB_BUILD) {
			var link_identifier = utils.getParamValue('_branch_match_id') || utils.hashValue('r');
			this._api(resources._r, { "v": config.version }, wrapErrorFunc(function(browser_fingerprint_id) {
				self._api(resources.open, {
					"link_identifier": link_identifier,
					"is_referrable": 1,
					"browser_fingerprint_id": browser_fingerprint_id
				}, wrapErrorFunc(function(data) {
					setBranchValuesWeb(data);
					if (link_identifier) { data['click_id'] = link_identifier; }
					utils.store(data, self._storage);
					if (callback) { callback(null, utils.whiteListSessionData(data)); }
				}, callback));
			}, callback));
		}
	}
};

/**
 * @function Branch.data
 * @param {function(?Error, utils.sessionData=)=} callback - _optional_ - callback to read the session data.
 *
 * Returns the same session information and any referring data, as
 * `Branch.init`, but does not require the `app_id`. This is meant to be called
 * after `Branch.init` has been called if you need the session information at a
 * later point.
 * If the Branch session has already been initialized, the callback will return
 * immediately, otherwise, it will return once Branch has been initialized.
 * ___
 */
Branch.prototype['data'] = function(callback) {
	if (!callback) { return; }

	var self = this;
	this._queue(function(next) {
		callback(null, utils.whiteListSessionData(utils.readStore(self._storage)));
		next();
	});
};

if (utils.CORDOVA_BUILD) {
/**
 * @function Branch.first
 * @param {function(?Error, utils.sessionData=)=} callback - _optional_ - callback to read the session data.
 *
 * Returns the same session information and any referring data, as
 * `Branch.init` did when the app was first installed. This is meant to be called
 * after `Branch.init` has been called if you need the first session information at a
 * later point.
 * If the Branch session has already been initialized, the callback will return
 * immediately, otherwise, it will return once Branch has been initialized.
 *
 * THIS METHOD IS CURRENTLY ONLY AVAILABLE IN THE CORDOVA/PHONEGAP PLUGIN
 *
 * ___
 *
 */
	Branch.prototype['first'] = function(callback) {
		if (!callback) { return; }

		var self = this;
		this._queue(function(next) {
			callback(null, utils.whiteListSessionData(utils.readStore(self._permStorage)));
			next();
		});
	};
}

/**
 * @function Branch.setIdentity
 * @param {string} identity - _required_ - a string uniquely identifying the user – often a user ID or email address.
 * @param {function(?Error, Object=)=} callback - _optional_ - callback that returns the user's Branch identity id and unique link.
 *
 * **[Formerly `identify()`](CHANGELOG.md)**
 *
 * Sets the identity of a user and returns the data. To use this function, pass
 * a unique string that identifies the user - this could be an email address,
 * UUID, Facebook ID, etc.
 *
 * ##### Usage
 * ```js
 * branch.setIdentity(
 *     identity,
 *     callback (err, data)
 * );
 * ```
 *
 * ##### Callback Format
 * ```js
 * callback(
 *      "Error message",
 *      {
 *           identity_id:        '12345', // Server-generated ID of the user identity, stored in `sessionStorage`.
 *           link:               'url',   // New link to use (replaces old stored link), stored in `sessionStorage`.
 *           referring_data:     { },      // Returns the initial referring data for this identity, if exists.
 *           referring_identity: '12345'  // Returns the initial referring identity for this identity, if exists.
 *      }
 * );
 * ```
 * ___
 */
Branch.prototype['setIdentity'] = function(identity, callback) {
	if (!this.initialized) { return wrapError(new Error(utils.message(utils.messages.nonInit)), callback); }

	function setBranchValues(data) {
		self.identity_id = data['identity_id'];
		self.sessionLink = data['link'];
		self.identity = data['identity'];
	}

	if (utils.CORDOVA_BUILD) {
		var self = this;

		this._api(resources.profile, { "identity": identity }, wrapErrorFunc(function(data) {
			setBranchValues(data);
			if (callback) { callback(null, data); }
		}, callback));
	}

	if (utils.WEB_BUILD) {
		this._api(resources.profile, { "identity": identity }, wrapErrorCallback2(callback));
	}
};

/**
 * @function Branch.logout
 * @param {function(?Error)=} callback - _optional_
 *
 * Logs out the current session, replaces session IDs and identity IDs.
 *
 * ##### Usage
 * ```js
 * branch.logout(
 *     callback (err)
 * );
 * ```
 *
 * ##### Callback Format
 * ```js
 * callback(
 *      "Error message"
 * );
 * ```
 * ___
 *
 */
Branch.prototype['logout'] = function(callback) {
	if (!this.initialized) { return wrapError(new Error(utils.message(utils.messages.nonInit)), callback); }
	this._api(resources.logout, { }, wrapErrorCallback1(callback));
};

if (utils.CORDOVA_BUILD) {
/**
 * @function Branch.close
 * @param {function(?Error)=} callback - _optional_
 *
 * Close the current session.
 *
 * ##### Usage
 * ```js
 * branch.close(
 *     callback (err)
 * );
 * ```
 *
 * ##### Callback Format
 * ```js
 * callback(
 *      "Error message"
 * );
 * ```
 *
 * THIS METHOD IS CURRENTLY ONLY AVAILABLE IN THE CORDOVA/PHONEGAP PLUGIN
 *
 * ___
 *
 * ## Tracking events
 *
 */
	Branch.prototype['close'] = function(callback) {
		if (!this.initialized) { return wrapError(new Error(utils.message(utils.messages.nonInit)), callback); }

		var self = this;

		function clearBranchValues() {
			delete self.session_id;
			delete self.sessionLink;
			self.initialized = false;
		}

		this._api(resources.close, { }, wrapErrorFunc(function(data) {
			clearBranchValues();
			utils.clearStore(self._storage);
			if (callback) { callback(null); }
		}, callback));
	};
}

/**
 * @function Branch.track
 * @param {string} event - _required_ - name of the event to be tracked.
 * @param {Object=} metadata - _optional_ - object of event metadata.
 * @param {function(?Error)=} callback - _optional_
 *
 * This function allows you to track any event with supporting metadata. Use the events you track to create funnels in the Branch dashboard.
 * The `metadata` parameter is a formatted JSON object that can contain any data and has limitless hierarchy.
 *
 * ##### Usage
 * ```js
 * branch.event(
 *     event,
 *     metadata,
 *     callback (err)
 * );
 * ```
 *
 * ##### Callback Format
 * ```js
 * callback("Error message");
 * ```
 * ___
 *
 * # Deeplinking Methods
 *
 * ## Creating a deep linking link
 *
 */
Branch.prototype['track'] = function(event, metadata, callback) {
	if (typeof metadata == 'function') {
		callback = metadata;
		metadata = { };
	}

	if (!this.initialized) { return wrapError(new Error(utils.message(utils.messages.nonInit)), callback); }

	this._api(resources.event, {
		"event": event,
		"metadata": utils.merge({
			"url": document.URL,
			"user_agent": navigator.userAgent,
			"language": navigator.language
		}, metadata || {})
	}, wrapErrorCallback1(callback));
};

/**
 * @function Branch.link
 * @param {Object} linkData - _required_ - link data and metadata.
 * @param {function(?Error,String=)} callback - _required_ - returns a string of the Branch deep linking URL.
 *
 * **[Formerly `createLink()`](CHANGELOG.md)**
 *
 * Creates and returns a deep linking URL.  The `data` parameter can include an
 * object with optional data you would like to store, including Facebook
 * [Open Graph data](https://developers.facebook.com/docs/opengraph).
 *
 * #### Usage
 * ```
 * branch.link(
 *     linkData,
 *     callback (err, link)
 * );
 * ```
 *
 * #### Example
 * ```js
 * branch.link({
 *     tags: [ 'tag1', 'tag2' ],
 *     channel: 'facebook',
 *     feature: 'dashboard',
 *     stage: 'new user',
 *     type: 1,
 *     data: {
 *         mydata: 'something',
 *         foo: 'bar',
 *         '$desktop_url': 'http://myappwebsite.com',
 *         '$ios_url': 'http://myappwebsite.com/ios',
 *         '$ipad_url': 'http://myappwebsite.com/ipad',
 *         '$android_url': 'http://myappwebsite.com/android',
 *         '$og_app_id': '12345',
 *         '$og_title': 'My App',
 *         '$og_description': 'My app\'s description.',
 *         '$og_image_url': 'http://myappwebsite.com/image.png'
 *     }
 * }, function(err, link) {
 *     console.log(err, link);
 * });
 * ```
 *
 * ##### Callback Format
 * ```js
 * callback(
 *     "Error message",
 *     'https://bnc.lt/l/3HZMytU-BW' // Branch deep linking URL
 * );
 * ```
 * ___
 *
 * ## Sharing links via SMS
 *
 */
Branch.prototype['link'] = function(linkData, callback) {
	if (!this.initialized) { return wrapError(new Error(utils.message(utils.messages.nonInit)), callback); }

	var self = this;

	if (utils.WEB_BUILD) {
		linkData['source'] = 'web-sdk';
		if (linkData['data']['$desktop_url'] !== undefined) {
			linkData['data']['$desktop_url'] = linkData['data']['$desktop_url'].replace(/#r:[a-z0-9-_]+$/i, '');
		}
	}

	linkData['data'] = goog.json.serialize(linkData['data']);
	this._api(resources.link, linkData, wrapErrorFunc(function(data) {
		callback(null, data && data['url']);
	}, callback));
};

/**
 * @function Branch.sendSMS
 * @param {string} phone - _required_ - phone number to send SMS to
 * @param {Object} linkData - _required_ - object of link data
 * @param {Object=} options - _optional_ - options: make_new_link, which forces the creation of a new link even if one already exists
 * @param {function(?Error)=} callback - _optional_ - Returns an error if unsuccessful
 *
 * **[Formerly `SMSLink()`](CHANGELOG.md)**
 *
 * A robust function to give your users the ability to share links via SMS. If
 * the user navigated to this page via a Branch link, `sendSMS` will send that
 * same link. Otherwise, it will create a new link with the data provided in
 * the `metadata` argument. `sendSMS` also  registers a click event with the
 * `channel` pre-filled with `'sms'` before sending an sms to the provided
 * `phone` parameter. This way the entire link click event is recorded starting
 * with the user sending an sms.
 *
 * **Note**: `sendSMS` will *automatically* send a previously generated link click,
 * along with the `data` object in the original link. Therefore, it is unneccessary for the
 * `data()` method to be called to check for an already existing link. If a link already
 * exists, `sendSMS` will simply ignore the `data` object passed to it, and send the existing link.
 * If this behaivior is not desired, set `make_new_link: true` in the `options` object argument
 * of `sendSMS`, and `sendSMS` will always make a new link.
 *
 * **Supports international SMS**.
 *
 * #### Usage
 * ```js
 * branch.sendSMS(
 *     phone,
 *     linkData,
 *     options,
 *     callback (err, data)
 * );
 * ```
 *
 * ##### Example
 * ```js
 * branch.sendSMS(
 *     phone: '9999999999',
 *     {
 *         tags: ['tag1', 'tag2'],
 *         channel: 'facebook',
 *         feature: 'dashboard',
 *         stage: 'new user',
 *         type: 1,
 *         data: {
 *             mydata: 'something',
 *             foo: 'bar',
 *             '$desktop_url': 'http://myappwebsite.com',
 *             '$ios_url': 'http://myappwebsite.com/ios',
 *             '$ipad_url': 'http://myappwebsite.com/ipad',
 *             '$android_url': 'http://myappwebsite.com/android',
 *             '$og_app_id': '12345',
 *             '$og_title': 'My App',
 *             '$og_description': 'My app\'s description.',
 *             '$og_image_url': 'http://myappwebsite.com/image.png'
 *         }
 *     },
 *     { make_new_link: true }, // Default: false. If set to true, sendSMS will generate a new link even if one already exists.
 *     function(err) { console.log(err); }
 * });
 * ```
 *
 * ##### Callback Format
 * ```js
 * callback("Error message");
 * ```
 *
 * THIS METHOD IS CURRENTLY ONLY AVAILABLE IN THE WEB SDK NOT THE CORDOVA/PHONEGAP PLUGIN
 *
 * ___
 *
 * # Referral system rewarding functionality
 * In a standard referral system, you have 2 parties: the original user and the invitee. Our system is flexible enough to handle rewards for all users for any actions. Here are a couple example scenarios:
 * 1. Reward the original user for taking action (eg. inviting, purchasing, etc)
 * 2. Reward the invitee for installing the app from the original user's referral link
 * 3. Reward the original user when the invitee takes action (eg. give the original user credit when their the invitee buys something)
 *
 * These reward definitions are created on the dashboard, under the 'Reward Rules' section in the 'Referrals' tab on the dashboard.
 *
 * Warning: For a referral program, you should not use unique awards for custom events and redeem pre-identify call. This can allow users to cheat the system.
 *
 * ## Retrieve referrals list
 *
 */
Branch.prototype['sendSMS'] = function(phone, linkData, options, callback) {
	if (!this.initialized) { return wrapError(new Error(utils.message(utils.messages.nonInit)), callback); }
	if (typeof options == 'function') {
		callback = options;
		options = { };
	}
	else if (typeof options === 'undefined' || options === null) {
		options = { };
	}
	options["make_new_link"] = options["make_new_link"] || false;
	var self = this;
	if (!linkData['channel'] || linkData['channel'] == 'app banner') { linkData['channel'] = 'sms'; }

	function sendSMS(click_id) {
		self._api(resources.SMSLinkSend, {
			"link_url": click_id,
			"phone": phone
		}, wrapErrorCallback1(callback));
	}

	if (utils.readKeyValue('click_id', this._storage) && !options['make_new_link']) {
		sendSMS(utils.readKeyValue('click_id', this._storage));
	}
	else {
		this["link"](linkData, wrapErrorFunc(function(url) {
			self._api(resources.linkClick, {
				"link_url": 'l/' + url.split('/').pop(),
				"click": "click"
			}, wrapErrorFunc(function(data) {
				utils.storeKeyValue('click_id', data['click_id'], self._storage);
				sendSMS(data['click_id']);
			}, callback));
		}, callback));
	}
};

/**
 * @function Branch.referrals
 * @param {function(?Error,Object=)=} callback - _required_ - returns an object with referral data.
 *
 * **[Formerly `showReferrals()`](CHANGELOG.md)**
 *
 * Retrieves a complete summary of the referrals the current user has made.
 *
 * ##### Usage
 * ```js
 * branch.referrals(
 *     callback (err, data)
 * );
 * ```
 *
 * ##### Callback Format
 * ```js
 * callback(
 *     "Error message",
 *     {
 *         'install': {
 *              total: 5,
 *              unique: 2
 *         },
 *         'open': {
 *              total: 4,
 *              unique: 3
 *         },
 *         'buy': {
 *             total: 7,
 *             unique: 3
 *         }
 *     }
 * );
 * ```
 *
 * ## Referral Codes
 *
 */
Branch.prototype['referrals'] = function(callback) {
	if (!this.initialized) { return wrapError(new Error(utils.message(utils.messages.nonInit)), callback); }
	this._api(resources.referrals, { }, wrapErrorCallback2(callback));
};


if (utils.CORDOVA_BUILD) {
/**
 * @function Branch.getCode
 * @param {Object} data - _required_ - contins options for referral code creation.
 * @param {function(?Error)=} callback - _optional_ - returns an error if unsuccessful
 *
 * Create a referral code using the supplied parameters.  The code can be given to other users to enter.  Applying the code will add credits to the referrer, referree or both.
 * The data can containt the following fields:
 * "amount" - A required integer specifying the number of credits added when the code is applied.
 * "bucket" - The optional bucket to apply the credits to.  Defaults to "default".
 * "calculation_type" - A required integer.  1 for unlimited uses, 0 for one use.
 * "location" - A required integer. Determines who get's the credits.  0 for the referree, 2 for the referring user or 3 for both.
 * "prefix" - An optional string to be prepended to the code.
 * "expiration" - An optional date string.  If present, determines the date on which the code expires.
 *
 * ##### Usage
 *
 * branch.getCode(
 *     data,
 *     callback(err,data)
 * );
 *
 * ##### Example
 *
 * ```js
 * branch.getCode(
 *     {
 *       "amount":10,
 *       "bucket":"party",
 *       "calculation_type":1,
 *       "location":2
 *     }
 *     callback (err)
 * );
 * ```
 *
 * ##### Callback Format
 * ```js
 * callback(
 *      "Error message",
 *      {
 *        "referral_code":"AB12CD"
 *      }
 * );
 * ```
 *
 * THIS METHOD IS CURRENTLY ONLY AVAILABLE IN THE CORDOVA/PHONEGAP PLUGIN
 *
 * ___
 *
 */
	Branch.prototype['getCode'] = function(data, callback) {
		if (!this.initialized) { return wrapError(new Error(utils.message(utils.messages.nonInit)), callback); }
		data.type = "credit";
		data.creation_type = 2;
		this._api(resources.getCode, data, wrapErrorCallback2(callback));
	};
}

if (utils.CORDOVA_BUILD) {
/**
 * @function Branch.validateCode
 * @param {string} code - _required_ - the code string to validate.
 * @param {function(?Error)=} callback - _optional_ - returns an error if unsuccessful
 *
 * Validate a referral code before using.
 *
 * ##### Usage
 *
 * ```js
 * branch.validateCode(
 *     code, // The code to validate
 *     callback (err)
 * );
 * ```
 *
 * ##### Example
 *
 * ```js
 * branch.validateCode(
 *     "AB12CD",
 *     function(err, data) {
 *         if (err) {
 *             console.log(err);
 *         } else {
 *             console.log("Code is valid");
 *         }
 *     }
 * );
 * ```
 *
 * ##### Callback Format
 * ```js
 * callback(
 *     "Error message",
 *     callback(err, data)
 * );
 * ```
 *
 * THIS METHOD IS CURRENTLY ONLY AVAILABLE IN THE CORDOVA/PHONEGAP PLUGIN
 *
 * ___
 *
 */
	Branch.prototype['validateCode'] = function(code, callback) {
		if (!this.initialized) { return wrapError(new Error(utils.message(utils.messages.nonInit)), callback); }
		this._api(resources.validateCode, { "code": code }, wrapErrorCallback2(callback));
	};
}

if (utils.CORDOVA_BUILD) {
/**
 * @function Branch.applyCode
 * @param {string} code - _required_ - the code string to apply.
 * @param {function(?Error)=} callback - _optional_ - returns an error if unsuccessful
 *
 * Apply a referral code.
 *
 * ##### Usage
 *
 * ```js
 * branch.applyCode(
 *     code, // The code to apply
 *     callback (err)
 * );
 * ```
 *
 * ##### Example
 *
 * ```js
 * branch.applyCode(
 *     "AB12CD",
 *     function(err, data) {
 *         if (err) {
 *             console.log(err);
 *         } else {
 *             console.log("Code applied");
 *         }
 *     }
 * );
 * ```
 *
 * ##### Callback Format
 * ```js
 * callback(
 *     "Error message",
 *     callback(err, data)
 * );
 * ```
 *
 * THIS METHOD IS CURRENTLY ONLY AVAILABLE IN THE CORDOVA/PHONEGAP PLUGIN
 *
 * ___
 *
 * ## Credit Functions
 *
 */
	Branch.prototype['applyCode'] = function(code, callback) {
		if (!this.initialized) { return wrapError(new Error(utils.message(utils.messages.nonInit)), callback); }
		this._api(resources.applyCode, { "code": code }, wrapErrorCallback2(callback));
	};
}

/**
 * @function Branch.credits
 * @param {function(?Error,Object=)=} callback - _required_ - returns an object with credit data.
 *
 * **[Formerly `showCredits()`](CHANGELOG.md)**
 *
 * This call will retrieve the entire history of credits and redemptions from the individual user.
 *
 * ##### Usage
 * ```js
 * branch.credits(
 *     callback (err, data)
 * );
 * ```
 *
 * ##### Callback Format
 * ```js
 * callback(
 *     "Error message",
 *     {
 *         'default': 15,
 *         'other bucket': 9
 *     }
 * );
 * ```
 *
 */
Branch.prototype['credits'] = function(callback) {
	if (!this.initialized) {
		return wrapError(new Error(utils.message(utils.messages.nonInit)), callback);
	}
	this._api(resources.credits, { }, wrapErrorCallback2(callback));
};


if (utils.CORDOVA_BUILD) {
/**
 * @function Branch.creditHistory
 * @param {Object} data - _optional_ - options controlling the returned history.
 * @param {function(?Error,Object=)=} callback - _required_ - returns an array with credit history data.
 *
 * This call will retrieve the entire history of credits and redemptions from the individual user.
 *
 * ##### Usage
 *
 * ```js
 * branch.creditHistory(
 *      data,
 *      callback(err, data)
 * );
 *
 * ##### Example
 *
 * ```js
 * branch.creditHistory(
 *     {
 *       "length":50,
 *       "direction":0,
 *       "begin_after_id:"123456789012345",
 *       "bucket":"default"
 *     }
 *     callback (err, data)
 * );
 * ```
 *
 * ##### Callback Format
 * ```js
 * callback(
 *     "Error message",
 * [
 *     {
 *         "transaction": {
 *                            "date": "2014-10-14T01:54:40.425Z",
 *                            "id": "50388077461373184",
 *                            "bucket": "default",
 *                            "type": 0,
 *                            "amount": 5
 *                        },
 *         "referrer": "12345678",
 *         "referree": null
 *     },
 *     {
 *         "transaction": {
 *                            "date": "2014-10-14T01:55:09.474Z",
 *                            "id": "50388199301710081",
 *                            "bucket": "default",
 *                            "type": 2,
 *                            "amount": -3
 *                        },
 *         "referrer": null,
 *         "referree": "12345678"
 *     }
 * ]
 * );
 * ```
 *
 * THIS METHOD IS CURRENTLY ONLY AVAILABLE IN THE CORDOVA/PHONEGAP PLUGIN
 *
 * ---
 *
 * ## Credit redemption
 *
 */
	Branch.prototype['creditHistory'] = function(data, callback) {
		if (!this.initialized) {
			return wrapError(new Error(utils.message(utils.messages.nonInit)), callback);
		}
		this._api(resources.creditHistory, data ? data : {}, wrapErrorCallback2(callback));
	};
}

/**
 * @function Branch.redeem
 * @param {number} amount - _required_ - an `amount` (int) of number of credits to redeem
 * @param {string} bucket - _required_ - the name of the `bucket` (string) of which bucket to redeem the credits from
 * @param {function(?Error)=} callback - _optional_ - returns an error if unsuccessful
 *
 * **[Formerly `redeemCredits()`](CHANGELOG.md)**
 *
 * Credits are stored in `buckets`, which you can define as points, currency, whatever makes sense for your app. When you want to redeem credits, call this method with the number of points to be redeemed, and the bucket to redeem them from.
 *
 * ```js
 * branch.redeem(
 *     amount, // amount of credits to be redeemed
 *     bucket,  // String of bucket name to redeem credits from
 *     callback (err)
 * );
 * ```
 *
 * ##### Example
 *
 * ```js
 * branch.redeem(
 *     5,
 *     "Rubies",
 *     function(err) {
 *         console.log(err);
 *     }
 * );
 * ```
 *
 * ##### Callback Format
 * ```js
 * callback("Error message");
 * ```
 * ___
 *
 * # Smart App Sharing Banner
 *
 * The Branch Web SDK has a built in sharing banner, that automatically displays a device specific banner for desktop, iOS, and Android. If the banner is shown on a desktop, a form for sending yourself the download link via SMS is shown.
 * Otherwise, a button is shown that either says an "open" app phrase, or a "download" app phrase, based on whether or not the user has the app installed. Both of these phrases can be specified in the parameters when calling the banner function.
 * **Styling**: The banner automatically styles itself based on if it is being shown on the desktop, iOS, or Android.
 *
 */
Branch.prototype['redeem'] = function(amount, bucket, callback) {
	if (!this.initialized) { return wrapError(new Error(utils.message(utils.messages.nonInit)), callback); }
	this._api(resources.redeem, { "amount": amount, "bucket": bucket }, wrapErrorCallback1(callback));
};

if (utils.WEB_BUILD) {
/**
 * @function Branch.banner
 * @param {Object} options - _required_ - object of all the options to setup the banner
 * @param {Object} linkData - _required_ - object of all link data, same as Branch.link()
 *
 * **[Formerly `appBanner()`](CHANGELOG.md)**
 *
 * Display a smart banner directing the user to your app through a Branch referral link.  The `linkData` param is the exact same as in `branch.link()`.
 *
 * | iOS Smart Banner | Android Smart Banner | Desktop Smart Banner |
 * |------------------|----------------------|----------------------|
 * | ![iOS Smart Banner](docs/images/ios-web-sdk-banner-1.0.0.png) | ![Android Smart Banner](docs/images/android-web-sdk-banner-1.0.0.png) | ![Desktop Smart Banner](docs/images/desktop-web-sdk-banner-1.0.0.png) |
 *
 * THIS METHOD IS ONLY AVAILABLE IN THE WEB SDK NOT IN THE CORDOVA/PHONEGAP PLUGIN
 *
 * #### Usage
 *
 * ```js
 * branch.banner(
 *     options, // Banner options: See example for all available options
 *     linkData // Data for link, same as Branch.link()
 * );
 * ```
 *
 * ##### Example
 *
 * ```js
 * branch.banner({
 *     icon: 'http://icons.iconarchive.com/icons/wineass/ios7-redesign/512/Appstore-icon.png',
 *     title: 'Branch Demo App',
 *     description: 'The Branch demo app!',
 *     openAppButtonText: 'Open',         // Text to show on button if the user has the app installed
 *     downloadAppButtonText: 'Download', // Text to show on button if the user does not have the app installed
 *     iframe: true,                      // Show banner in an iframe, recomended to isolate Branch banner CSS
 *     showiOS: true,                     // Should the banner be shown on iOS devices?
 *     showAndroid: true,                 // Should the banner be shown on Android devices?
 *     showDesktop: true,                 // Should the banner be shown on desktop devices?
 *     disableHide: false,                // Should the user have the ability to hide the banner? (show's X on left side)
 *     forgetHide: false,                 // Should we remember or forget whether the user hid the banner?
 *     make_new_link: false               // Should the banner create a new link, even if a link already exists?
 * }, {
 *     phone: '9999999999',
 *     tags: ['tag1', 'tag2'],
 *     feature: 'dashboard',
 *     stage: 'new user',
 *     type: 1,
 *     data: {
 *         mydata: 'something',
 *         foo: 'bar',
 *         '$desktop_url': 'http://myappwebsite.com',
 *         '$ios_url': 'http://myappwebsite.com/ios',
 *         '$ipad_url': 'http://myappwebsite.com/ipad',
 *         '$android_url': 'http://myappwebsite.com/android',
 *         '$og_app_id': '12345',
 *         '$og_title': 'My App',
 *         '$og_description': 'My app\'s description.',
 *         '$og_image_url': 'http://myappwebsite.com/image.png'
 *     }
 * });
 * ```
 */
	Branch.prototype['banner'] = function(options, linkData) {
		var bannerOptions = {
			icon: options['icon'] || '',
			title: options['title'] || '',
			description: options['description'] || '',
			openAppButtonText: options['openAppButtonText'] || 'View in app',
			downloadAppButtonText: options['downloadAppButtonText'] || 'Download App',
			iframe: typeof options['iframe'] == 'undefined' ? true : options['iframe'],
			showiOS: typeof options['showiOS'] == 'undefined' ? true : options['showiOS'],
			showAndroid: typeof options['showAndroid'] == 'undefined' ? true : options['showAndroid'],
			showDesktop: typeof options['showDesktop'] == 'undefined' ? true : options['showDesktop'],
			disableHide: !!options['disableHide'],
			forgetHide: !!options['forgetHide'],
			make_new_link: !!options['make_new_link']
		};

		if (typeof options['showMobile'] != 'undefined') {
			bannerOptions.showiOS = bannerOptions.showAndroid = options['showMobile'];
		}

		banner(this, bannerOptions, linkData, this._storage);
	};
}
