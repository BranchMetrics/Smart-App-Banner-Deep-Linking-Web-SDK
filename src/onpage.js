/**
 * This is the actual embed script that people put on their page. I use the
 * technique of passing in variables as function parameters, even if not
 * defined, to remove the need for a `var` statement.
 *
 * This script creates a window.branch object with a number of calls. When you
 * call them, it saves your call for later.
 */
'use strict';

(function(root, branchStr, createCallback, branchSdk, funcs, i) {
	if (!root[branchStr]) {
		while (i < funcs.length) {
			createCallback(branchSdk, funcs[i++]);
		}

		root[branchStr] = branchSdk;
	}
})(
	window, 'branch', function(branch, name) {
		branch[name] = function() {
			branch._q.push([ name, arguments ]);
		};
	},
	{
		_q: [], // _q: the "queue" of calls
		_v: 1 // _v: the "version" of the embed script
	},
	[
		'addListener',
		'applyCode',
		'autoAppIndex',
		'banner',
		'closeBanner',
		'closeJourney',
		'creditHistory',
		'credits',
		'data',
		'deepview',
		'deepviewCta',
		'first',
		'getCode',
		'init',
		'link',
		'logout',
		'redeem',
		'referrals',
		'removeListener',
		'sendSMS',
		'setBranchViewData',
		'setIdentity',
		'track',
		'validateCode',
		'trackCommerceEvent',
		'logEvent',
		'disableTracking',
		'getBrowserFingerprintId'
	],
	0
);
