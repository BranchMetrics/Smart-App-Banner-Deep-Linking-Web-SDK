'use strict';
goog.provide('branch_view');
goog.require('utils');
goog.require('banner_css');
goog.require('safejson');

function renderHtmlBlob(parent, html, hasApp) {
	var re, match, ctaText = hasApp ? 'OPEN' : 'GET';

	// journey metadata
	re = /<script type="application\/json">((.|\s)*?)<\/script>/;
	match = html.match(re);
	if(match) {
		var src = match[1];
		html = html.replace(re,'');

		var metadata = safejson.parse(src);
		if(hasApp && metadata && metadata['ctaText'] && metadata['ctaText']['has_app']) {
			ctaText = metadata['ctaText']['has_app'];
		}
		else if(metadata && metadata['ctaText'] && metadata['ctaText']['no_app']) {
			ctaText = metadata['ctaText']['no_app'];
		}

		if (metadata && metadata.injectorSelector) {
			var parentTrap = document.querySelector(metadata.injectorSelector);
			if (parentTrap) {
				parent = parentTrap;
				parent.innerHTML = '';
			}
			else {
				return null;
			}
		}
	}

	// javascript injection
	re = /<script type="text\/javascript">((.|\s)*?)<\/script>/;
	match = html.match(re);
	if(match) {
		var src = match[1];
		html = html.replace(re,'');
		var script = document.createElement('script');
		script.innerHTML = src;
		document.body.appendChild(script);
	}

	parent = parent || document.body;
	var banner = document.createElement('div');
	banner.id = 'branch-banner-container';
	banner.className = 'branch-animation';
	banner.innerHTML = html;
	banner.querySelector('#branch-mobile-action').innerHTML = ctaText;

	banner_utils.addClass(banner, 'branch-banner-is-active');

	if(parent === document.body) {
		parent.insertBefore(banner, parent.firstChild);
	}
	else {
		parent.appendChild(banner);
	}

	return banner;
};


/**
 * @param {Object} server
 * @param {Object} branchViewData
 * @param {Object} requestData
 * @param {Object} storage
 * @param {Boolean} hasApp
 */
branch_view.handleBranchViewData = function(server, branchViewData, requestData, storage, hasApp) {
	requestData = requestData || {};
	requestData['feature'] = 'journeys';

	var cleanedData = utils.cleanLinkData(requestData);

	if (document.getElementById('branch-banner') ||
		document.getElementById('branch-banner-iframe') ||
		document.getElementById('branch-banner-container')) {
		return;
	}

	var placeholder = document.createElement('div');
	placeholder.id = 'branch-banner';
	document.body.insertBefore(placeholder, null);
	banner_utils.addClass(placeholder, 'branch-banner-is-active');

	if (storage.get('hideBanner', true)) {
		return;
	}

	if (branchViewData['html']) {
		return renderHtmlBlob(document.body, branchViewData['html'], hasApp);
	} else if (branchViewData['url']) {
		var banner = null;
		var cta = null;

		function destroyBanner() {
			banner_utils.addClass(banner.querySelector('#branch-banner'), 'branch-animation-out');
			banner_utils.removeClass(banner.querySelector('#branch-banner'), 'branch-animation-in');
			setTimeout(function() {
				banner.parentElement.removeChild(banner);
			}, 250);
		}

		function finalHookups(cta, banner) {
			if(!cta || !banner) {
				return;
			}

			setTimeout(function() {
				banner_utils.removeClass(banner.querySelector('#branch-banner'), 'branch-animation-out');
				banner_utils.addClass(banner.querySelector('#branch-banner'), 'branch-animation-in');
			}, 250);

			var actionEls = banner.querySelectorAll('#branch-mobile-action');
			Array.prototype.forEach.call(actionEls, function(el) {
				el.addEventListener('click', function(e) {
					cta();
					destroyBanner();
				})
			})
			var cancelEls = banner.querySelectorAll('.branch-banner-continue');
			Array.prototype.forEach.call(cancelEls, function(el) {
				el.addEventListener('click', function(e) {
					destroyBanner();
					storage.set('hideBanner', banner_utils.getDate(1), true);
				})
			})
			cancelEls = banner.querySelectorAll('.branch-banner-close');
			Array.prototype.forEach.call(cancelEls, function(el) {
				el.addEventListener('click', function(e) {
					destroyBanner();
					storage.set('hideBanner', banner_utils.getDate(1), true);
				})
			})
		}

		var callbackString = 'branch_view_callback__' + (jsonp_callback_index++);
		var postData = encodeURIComponent(utils.base64encode(goog.json.serialize(cleanedData)));
		var url = branchViewData['url'] + '&callback=' + callbackString;
		url += '&data=' + postData;
		server.XHRRequest(url, {}, 'GET', {}, function(error, html){
			var failed = false;
			if (!error && html) {

				var timeoutTrigger = window.setTimeout(
					function() {
						window[callbackString] = function() { };
					},
					TIMEOUT
				);

				window[callbackString] = function(data) {
					window.clearTimeout(timeoutTrigger);
					if (failed) {
						return;
					}
					cta = data;
					finalHookups(cta,banner);
				};


				banner = renderHtmlBlob(document.body, html, hasApp);
				if (banner === null) {
					failed = true;
					return;
				}
				finalHookups(cta,banner);
			}
			document.body.removeChild(placeholder);
		}, true);
	}
};
