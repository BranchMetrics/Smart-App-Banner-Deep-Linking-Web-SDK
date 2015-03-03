# Change Log
All notable changes to the Branch Web SDK will be documented here.
The Branch Web SDK adheres to [Semantic Versioning](http://semver.org/).

## [1.0.0] - 2015-3-2
### Changed
- **identify()** changed to **setIdentity()**. **setIdentity()** now accepts a single string `identity` and callback, rather than an object `{ identity: "string" }` and a callback.
- **appBanner()** changed to **banner()**. The banner still accepts a link data parameter, but now includes an options parameter. This allows custom Download and Open text: `openAppButtonText` or `downloadAppButtonText`, and the banner can be selectively disabled on either mobile or desktop. The banner will display the relevant text, dependent on whether the user has the app installed. The banner is now also embeded, by default, in an iFrame in order to isolate the CSS. This can optionally be turned off by setting `iframe: true` in the options parameters.
- **createLink()** changed to **link()**.
- **createLinkClick()** removed.
- **showReferrals()** changed to **referrals()**.
- **showCredits()** changed to **credits()**.
- **redeemCredits()** changed to **redeem()**.
- **SMSLink()** changed to **sendSMS()**. Additional parameter added: Now accepts, `metadata`, `callback`, and a third boolean value `make_new_link` which forces the creation of a new link, even if one already exists.

### Fixed
- Error with IE10 when hosting on http
- Numerous bugs, errors, and typos

### Added
- **Smart app sharing banner improvements**: The app banner has been significantly improved both stylistically, and functionally. The banner now mimics the style and animations of the native iOS 8 Smart App Banner on iOS devices, and has a beautiful material design look and feel on Android devices. Additionally, the banner has several contextual awareness features: 1. The banner stores in the session if the user has closed it, and it will stay closed on future page reloads. 2. The banner will show Download text if they user does not have the app installed, or if Branch has a record of the user installing the mobile app, it will instead show Open text.
- gzip compression
- Closure compiler Unit tests

## [0.1.1] - 2014-11-19

### Fixed
- Numerous bugs
- https
- Overall code cleanup and reorganization
