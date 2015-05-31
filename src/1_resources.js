/**
 * This provides a list of endpoints and client-side validation for any calls
 * to those endpoints.
 */

goog.provide('resources');

goog.require('utils');
goog.require('config');

/**
 * @const
 * @type {Object<*,utils.resource>}
 */
var resources = { };

/** @enum {number} */
var validationTypes = { obj: 0, str: 1, num: 2, arr: 3, bool: 4 };  // now includes bool

/* jshint ignore:start */

/** @typedef {function(string, string, *)} */
var _validator;

/* jshint ignore:end */

/**
 * @param {boolean} required
 * @param {validationTypes|RegExp} type
 * @throws {Error}
 * @return {_validator}
 */
function validator(required, type) {
	return function(endpoint, param, data) {
		// Must ensure data is not a number before doing a !data otherwise the number can't be 0.
		if ((typeof data != 'number') && !data) {
			if (required) { return utils.message(utils.messages.missingParam, [ endpoint, param ]); }
		}
		else if (type == validationTypes.obj) {
			if (typeof data != 'object') { return utils.message(utils.messages.invalidType, [ endpoint, param, 'an object' ]); }
		}
		else if (type == validationTypes.arr) {
			if (!(data instanceof Array)) { return utils.message(utils.messages.invalidType, [ endpoint, param, 'an array' ]); }
		}
		else if (type == validationTypes.num) {
			if (typeof data != 'number') { return utils.message(utils.messages.invalidType, [ endpoint, param, 'a number' ]); }
		}
		else if (type == validationTypes.bool) {
			if (typeof data != 'boolean') { return utils.message(utils.messages.invalidType, [ endpoint, param, 'a boolean' ]); }
		}
		// String or regex validator
		else if (typeof data != 'string') {
			return utils.message(utils.messages.invalidType, [ endpoint, param, 'a string' ]);
		}
		else if (type != validationTypes.str && !type.test(data)) {
			return utils.message(utils.messages.invalidType, [ endpoint, param, 'in the proper format' ]);
		}

		return false;
	};
}

var branch_id = /^[0-9]{15,20}$/;

function defaults(obj) {
	var def = {};
	if (WEB_BUILD) {
		def = {
			"session_id": validator(true, branch_id),
			"identity_id": validator(true, branch_id),
			"sdk": validator(true, validationTypes.str)
		};
	}
	if (CORDOVA_BUILD) {
		def = {
			"session_id": validator(true, branch_id),
			"identity_id": validator(true, branch_id),
			"device_fingerprint_id": validator(true, branch_id),
			"sdk": validator(true, validationTypes.str)
		};
	}
	return utils.merge(obj, def);
}

if (WEB_BUILD) {
	resources.open = {
		destination: config.api_endpoint,
		endpoint: "/v1/open",
		method:	 utils.httpMethod.POST,
		params: {
			"identity_id": validator(false, branch_id),
			"link_identifier": validator(false, validationTypes.str),
			"is_referrable": validator(true, validationTypes.num),
			"sdk": validator(false, validationTypes.str),
			"browser_fingerprint_id": validator(true, branch_id)
		}
	};

	resources._r = {
		destination: config.link_service_endpoint,
		endpoint: "/_r",
		method: utils.httpMethod.GET,
		jsonp: true,
		params: { "sdk": validator(true, validationTypes.str) }
	};

	resources.linkClick = {
		destination: config.link_service_endpoint,
		endpoint: "",
		method: utils.httpMethod.GET,
		queryPart: { "link_url": validator(true, validationTypes.str) },
		params: { "click": validator(true, validationTypes.str) }
	};

	resources.SMSLinkSend = {
		destination: config.link_service_endpoint,
		endpoint: "/c",
		method: utils.httpMethod.POST,
		queryPart: {
			"link_url": validator(true, validationTypes.str)
		},
		params: {
			"sdk": validator(false, validationTypes.str),
			"phone": validator(true, validationTypes.str)
		}
	};

	resources.close = {
		destination: config.api_endpoint,
		endpoint: "/v1/close",
		method: utils.httpMethod.POST,
		params: {
			"identity_id": validator(true, branch_id),
			"sdk": validator(true, validationTypes.str),
			"session_id": validator(true, branch_id),
			"link_click_id": validator(false, branch_id),
			"device_fingerprint_id": validator(true, branch_id)
		}
	};
}

if (CORDOVA_BUILD) { // jshint undef:false
	resources.install = {
		destination: config.api_endpoint,
		endpoint: "/v1/install",
		method:	 utils.httpMethod.POST,
		params: {
			"link_identifier": validator(false, validationTypes.str),
			"sdk": validator(false, validationTypes.str),
			"hardware_id": validator(false, validationTypes.str),
			"is_hardware_id_real": validator(false, validationTypes.bool),
			"app_version": validator(false, validationTypes.str),
			"carrier": validator(false, validationTypes.str),
			"bluetooth": validator(false, validationTypes.bool),
			"bluetooth_version": validator(false, validationTypes.str),
			"has_nfc": validator(false, validationTypes.bool),
			"has_telephone": validator(false, validationTypes.bool),
			"brand": validator(false, validationTypes.str),
			"model": validator(false, validationTypes.str),
			"os": validator(false, validationTypes.str),
			"uri_scheme": validator(false, validationTypes.str),
			"os_version": validator(false, validationTypes.str),
			"screen_dpi": validator(false, validationTypes.num),
			"screen_width": validator(false, validationTypes.num),
			"screen_height": validator(false, validationTypes.num),
			"is_referrable": validator(false, validationTypes.num),
			"update": validator(false, validationTypes.num),
			"add_tracking_enabled": validator(false, validationTypes.bool)
		}
	};

	resources.open = {
		destination: config.api_endpoint,
		endpoint: "/v1/open",
		method:	 utils.httpMethod.POST,
		params: {
			"identity_id": validator(true, branch_id),
			"link_identifier": validator(false, validationTypes.str),
			"device_fingerprint_id": validator(true, branch_id),
			"sdk": validator(false, validationTypes.str),
			"hardware_id": validator(false, validationTypes.str),
			"is_hardware_id_real": validator(false, validationTypes.bool),
			"app_version": validator(false, validationTypes.str),
			"os": validator(false, validationTypes.str),
			"uri_scheme": validator(false, validationTypes.str),
			"os_version": validator(false, validationTypes.str),
			"is_referrable": validator(false, validationTypes.num)
		}
	};
}

resources.getCode = {
	destination: config.api_endpoint,
	endpoint: "/v1/referralcode",
	method: utils.httpMethod.POST,
	params: defaults({
		"prefix": validator(false, validationTypes.str),
		"amount": validator(true, validationTypes.num),
		"expiration": validator(false, validationTypes.str),
		"calculation_type": validator(true, validationTypes.num),
		"location": validator(true, validationTypes.num),
		"creation_type": validator(true, validationTypes.num),
		"type": validator(true, validationTypes.str),
		"bucket": validator(false, validationTypes.str)
	})
};

resources.validateCode = {
	destination: config.api_endpoint,
	endpoint: "/v1/referralcode",
	method: utils.httpMethod.POST,
	queryPart: { "code": validator(true, validationTypes.str) },
	params: defaults({ })
};

resources.applyCode = {
	destination: config.api_endpoint,
	endpoint: "/v1/applycode",
	method: utils.httpMethod.POST,
	queryPart: { "code": validator(true, validationTypes.str) },
	params: defaults({ })
};

resources.logout = {
	destination: config.api_endpoint,
	endpoint: "/v1/logout",
	method: utils.httpMethod.POST,
	params: defaults({ "session_id": validator(true, branch_id) })
};

resources.profile = {
	destination: config.api_endpoint,
	endpoint: "/v1/profile",
	method:	 utils.httpMethod.POST,
	params: defaults({
		"identity_id": validator(true, branch_id),
		"identity": validator(true, validationTypes.str)
	})
};

resources.referrals = {
	destination: config.api_endpoint,
	endpoint: "/v1/referrals",
	method: utils.httpMethod.GET,
	queryPart: { "identity_id": validator(true, branch_id) },
	params: defaults({ })
};

resources.creditHistory = {
	destination: config.api_endpoint,
	endpoint: "/v1/credithistory",
	method: utils.httpMethod.GET,
	params: defaults({
		"link_click_id": validator(false, branch_id),
		"length": validator(false, validationTypes.num),
		"direction": validator(false, validationTypes.num),
		"begin_after_id": validator(false, branch_id),
		"bucket": validator(false, validationTypes.str)
	})
};

resources.credits = {
	destination: config.api_endpoint,
	endpoint: "/v1/credits",
	method: utils.httpMethod.GET,
	queryPart: { "identity_id": validator(true, branch_id) },
	params: defaults({ })
};

resources.redeem =  {
	destination: config.api_endpoint,
	endpoint: "/v1/redeem",
	method: utils.httpMethod.POST,
	params: defaults({
		"identity_id": validator(true, branch_id),
		"amount": validator(true, validationTypes.num),
		"bucket": validator(true, validationTypes.str)
	})
};

resources.link = {
	destination: config.api_endpoint,
	endpoint: "/v1/url",
	method: utils.httpMethod.POST,
	ref: "obj",
	params: defaults({
		"identity_id": validator(true, branch_id),
		"data": validator(false, validationTypes.str),
		"tags": validator(false, validationTypes.arr),
		"feature": validator(false, validationTypes.str),
		"channel": validator(false, validationTypes.str),
		"stage": validator(false, validationTypes.str),
		"type": validator(false, validationTypes.num),
		"alias": validator(false, validationTypes.str)
	})
};

resources.event = {
	destination: config.api_endpoint,
	endpoint: "/v1/event",
	method: utils.httpMethod.POST,
	params: defaults({
		"event": validator(true, validationTypes.str),
		"metadata": validator(true, validationTypes.obj)
	})
};
