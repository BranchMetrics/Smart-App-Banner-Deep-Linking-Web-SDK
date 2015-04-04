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
	this._storage = storage();
	this._permStorage = storage(true);  // For storing data we need from run to run such as device_fingerprint_id and 
										// the session params from the first install.
	this._server = new Server();
	this.sdk="cordova"+config.version;
	this.initialized = false;
	this.debug = false;
};

/***
 * @param {utils.resource} resource
 * @param {Object.<string, *>} obj
 * @param {function(?Error,?)=} callback
 */
Branch.prototype._api = function(resource, obj, callback) {
	var self = this;
	this._queue(function(next) {
		// This reflects additional fields needed by mobile apps...
		if (((resource.params && resource.params['app_id']) || (resource.queryPart && resource.queryPart['app_id'])) && self.app_id) { obj['app_id'] = self.app_id; }
		if (((resource.params && resource.params['session_id']) || (resource.queryPart && resource.queryPart['session_id'])) && self.session_id) { obj['session_id'] = self.session_id; }
		if (((resource.params && resource.params['identity_id']) || (resource.queryPart && resource.queryPart['identity_id'])) && self.identity_id) { obj['identity_id'] = self.identity_id; }
		if (((resource.params && resource.params['device_fingerprint_id']) || (resource.queryPart && resource.queryPart['device_fingerprint_id'])) && self.device_fingerprint_id) { obj['device_fingerprint_id'] = self.device_fingerprint_id; }
		if (((resource.params && resource.params['link_click_id']) || (resource.queryPart && resource.queryPart['link_click_id'])) && self.link_click_id) { obj['link_click_id'] = self.link_click_id; }
		if (((resource.params && resource.params['sdk']) || (resource.queryPart && resource.queryPart['sdk'])) && self.sdk) { obj['sdk'] = self.sdk; }
		return self._server.request(resource, obj, self._storage, function(err, data) {
			next();
			callback(err, data);
		});
	});
};


/**
 * @function Branch.setDebug
 * @param {boolean} debug - _required_ - Set the SDK debug flag.
 * 
 * Setting the SDK debug flag will generate a new device ID each time the app is installed
 * instead of possibly using the same device id.  This is useful when testing.
 * 
 * This needs to be set before the Branch.init call!!!
 * 
 * ---
 * 
 */
Branch.prototype['setDebug'] = function(debug) {
	this.debug = debug;
};

/**
 * @function Branch.init
 * @param {string} app_id - _required_ - Your Branch [app key](http://dashboard.branch.io/settings).
 * @param {function(?Error, utils.sessionData=)=} callback - _optional_ - callback to read the session data.
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
 *     callback (err, data)
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
 * 
 * ___
 * 
 */
Branch.prototype['init'] = function(app_id, callback) {
	if (this.initialized) { return wrapError(new Error(utils.message(utils.messages.existingInit)), callback); }

	this.app_id = app_id;
	var self = this,
		sessionData = utils.readStore(this._storage);

	function setBranchValues(data) {
		self.session_id = data['session_id'];
		self.identity_id = data['identity_id'];
		self.sessionLink = data['link'];
		self.device_fingerprint_id = data['device_fingerprint_id'];
		self.link_click_id = data['link_click_id'];
		self.initialized = true;
	}

	if (sessionData  && sessionData['session_id']) {
		setBranchValues(sessionData);
		if (callback) { callback(null, utils.whiteListSessionData(sessionData)); }
	}
	else {
		// If we have a stored identity_id this is not a new install so call open.  Otherwise call install.
		if (utils.readKeyValue('identity_id', self._permStorage)) {
			self.identity_id = utils.readKeyValue('identity_id', self._permStorage);
			self.device_fingerprint_id = utils.readKeyValue('device_fingerprint_id', self._permStorage);
			cordova.plugins.branch_device.getOpenData(self.debug, function(data) {
				console.log("Sending open.");
				self._api(resources.open, data, wrapErrorFunc(function(data) {
					console.log("Open successful: " + data);
					setBranchValues(data);
					utils.storeKeyValue('identity_id', data.identity_id, self._permStorage)
					utils.storeKeyValue('device_fingerprint_id', data.device_fingerprint_id, self._permStorage)
					utils.store(data, self._storage);
					if (callback) { callback(null, data); }
				}, callback));
			}, this);
		} else {
			cordova.plugins.branch_device.getInstallData(self.debug, function(data) {
				console.log("Sending install.");
				self._api(resources.install, data, wrapErrorFunc(function(data) {
					console.log("Install successful: " + data);
					setBranchValues(data);
					utils.store(data, self._storage);
					utils.store(data, self._permStorage);
					if (callback) { callback(null, data); }
				}, callback));
			}, this);
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
 * 
 * ___
 * 
 */
Branch.prototype['data'] = function(callback) {
	if (!callback) { return; }

	var self = this;
	this._queue(function(next) {
		callback(null, utils.whiteListSessionData(utils.readStore(self._storage)));
		next();
	});
};

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
 * 
 */
Branch.prototype['setIdentity'] = function(identity, callback) {
	if (!this.initialized) { return wrapError(new Error(utils.message(utils.messages.nonInit)), callback); }
	
	var self = this;
	
	function setBranchValues(data) {
		self.identity_id = data['identity_id'];
		self.sessionLink = data['link'];
		self.identity = data['identity'];
	}
	
	this._api(resources.profile, { "identity": identity }, wrapErrorFunc(function(data) {
		setBranchValues(data);
		if (callback) { callback(null, data); }
	}, callback));
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
	
	var self = this;
	
	function setBranchValues(data) {
		self.session_id = data['session_id'];
		self.identity_id = data['identity_id'];
		self.sessionLink = data['link'];
		delete self.identity;
	}
	
	this._api(resources.logout, { }, wrapErrorFunc(function(data) {
		setBranchValues(data);
		utils.clearStore(self._storage);
		utils.clearStore(self._permStorage);
		if (callback) { callback(null); }
	}, callback));
};

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
Branch.prototype['link'] = function(linkData, callback) {
	if (!this.initialized) { return wrapError(new Error(utils.message(utils.messages.nonInit)), callback); }

	var self = this;
	linkData['data'] = goog.json.serialize(linkData['data']);
	this._api(resources.link, linkData, wrapErrorFunc(function(data) {
		callback(null, data && data['url']);
	}, callback));
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
 * ---
 * 
 * ## Referral Codes
 * 
 */
Branch.prototype['referrals'] = function(callback) {
	if (!this.initialized) {
		return wrapError(new Error(utils.message(utils.messages.nonInit)), callback);
	}
	this._api(resources.referrals, { }, wrapErrorCallback2(callback));
};

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
 * ___
 *
 */
Branch.prototype['getCode'] = function(data, callback)  {
	if (!this.initialized) { return wrapError(new Error(utils.message(utils.messages.nonInit)), callback); }
	data.type = "credit";
	data.creation_type = 2;
	this._api(resources.getCode, data, wrapErrorCallback2(callback));
}

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
 * ___
 *
 */
Branch.prototype['validateCode'] = function(code, callback)  {
	if (!this.initialized) { return wrapError(new Error(utils.message(utils.messages.nonInit)), callback); }
	this._api(resources.validateCode, { "code": code }, wrapErrorCallback2(callback));
}

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
 * ___
 *
 * ## Credit Functions
 * 
 */
Branch.prototype['applyCode'] = function(code, callback)  {
	if (!this.initialized) { return wrapError(new Error(utils.message(utils.messages.nonInit)), callback); }
	this._api(resources.applyCode, { "code": code }, wrapErrorCallback2(callback));
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
 * ---
 * 
 */
Branch.prototype['credits'] = function(callback) {
	if (!this.initialized) {
		return wrapError(new Error(utils.message(utils.messages.nonInit)), callback);
	}
	this._api(resources.credits, { }, wrapErrorCallback2(callback));
};

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
 * ---
 * 
 * ## Credit redemption
 *
 */
Branch.prototype['creditHistory'] = function(data, callback) {
	if (!this.initialized) {
		return wrapError(new Error(utils.message(utils.messages.nonInit)), callback);
	}
	this._api(resources.creditHistory, (data)?data:{}, wrapErrorCallback2(callback));
};

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
 * ##### Usage
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
 */
Branch.prototype['redeem'] = function(amount, bucket, callback) {
	if (!this.initialized) { return wrapError(new Error(utils.message(utils.messages.nonInit)), callback); }
	this._api(resources.redeem, { "amount": amount, "bucket": bucket }, wrapErrorCallback1(callback));
};
