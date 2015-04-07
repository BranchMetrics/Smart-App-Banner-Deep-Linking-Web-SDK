# Branch Metrics Web SDK

This README outlines the functionality of the Branch Metrics Web SDK, and how to easily incorporate it into a web app.

Live demo: [https://cdn.branch.io/example.html](https://cdn.branch.io/example.html)

## Overview

The Branch Web SDK provides an easy way to interact with the Branch API on your website or web app. It requires no frameworks, and is only ~7K gzipped.

To use the Web SDK, you'll need to first initialize it with your API key found in your [Branch dashboard](https://dashboard.branch.io/#/settings). You'll also need to register when your users login with `setIdentity`, and when they logout with `logout`.

Once initialized, the Branch Web SDK allows you to create and share links with a banner, over SMS, or your own methods. It also offers event tracking, access to referrals, and management of credits.

## Installation

### Requirements

This SDK requires native browser Javascript and has been tested in all modern browsers with sessionStorage capability. No 3rd party libraries are needed to make use of the SDK as is it 100% native Javascript.

### Browser Specific Support
| Chrome | Firefox | Safari |     IE     |
| ------ | ------- | ------ | ---------- |
|    &#10004;   |    &#10004;    |   &#10004;    |  9, 10, 11 |

### API Key

You will need to create a [Branch Metrics app](http://branch.io) to obtain your app_key.

### Quick Install

#### Manual installation

_Be sure to replace `APP-KEY` with your actual app key found in your [account dashboard](https://dashboard.branch.io/#/settings)._

```html
<script type="text/javascript">
branch.init('APP-KEY', function(err, data) {
    // callback to handle err or data
});
</script>
```

#### Bower or npm installation

If you use Bower or npm, you can run `bower install branch-sdk` or `npm install branch-sdk` respectively to get the SDK.

#### Common.JS and RequireJS compatibility

In addition to working as a standalone library, the Branch SDK works great in CommonJS environments (browserify, webpack) as well as RequireJS environments (RequireJS/AMD). Just `require('branch')` or `define(['branch'], function(branch) { ... });` to get started!


## API Reference

1. Branch Session
  + [.init()](#initapp_id-callback)
  + [.setIdentity()](#setidentityidentity-callback)
  + [.logout()](#logoutcallback)

1. Event Tracking Methods
  + [.track()](#trackevent-metadata-callback)

1. Deeplinking Methods
   + [.link()](#linkmetadata-callback)
   + [.sendSMS()](#sendsmsphone-linkdata-options-callback)

1. Referral Methods
   + [.referrals()](#referralscallback)
   + [.credits()](#creditscallback)
   + [.redeem()](#redeemamount-bucket-callback)

1. Smart Banner
   + [.banner()](#banneroptions-linkdata)

___

# Global





* * *

### setDebug(debug) 

**Parameters**

**debug**: `boolean`, _required_ - Set the SDK debug flag.

Setting the SDK debug flag will generate a new device ID each time the app is installed
instead of possibly using the same device id.  This is useful when testing.

This needs to be set before the Branch.init call!!!

---



### init(app_id, callback, isReferrable) 

**Parameters**

**app_id**: `string`, _required_ - Your Branch [app key](http://dashboard.branch.io/settings).

**callback**: `function`, _optional_ - callback to read the session data.

**isReferrable**: `boolean`, _optional_ - Is this a referrable session.

Adding the Branch script to your page automatically creates a window.branch
object with all the external methods described below. All calls made to
Branch methods are stored in a queue, so even if the SDK is not fully
instantiated, calls made to it will be queued in the order they were
originally called.

The init function on the Branch object initiates the Branch session and
creates a new user session, if it doesn't already exist, in
`sessionStorage`.

**Useful Tip**: The init function returns a data object where you can read
the link the user was referred by.

##### Usage
```js
branch.init(
    app_id,
    callback (err, data)
);
```

##### Callback Format
```js
callback(
     "Error message",
     {
          data:               { },      // If the user was referred from a link, and the link has associated data, the data is passed in here.
          referring_identity: '12345', // If the user was referred from a link, and the link was created by a user with an identity, that identity is here.
          has_app:            true,    // Does the user have the app installed already?
          identity:       'BranchUser' // Unique string that identifies the user
     }
);
```

**Note:** `Branch.init` must be called prior to calling any other Branch functions.

___



### data(callback) 

**Parameters**

**callback**: `function`, _optional_ - callback to read the session data.

Returns the same session information and any referring data, as
`Branch.init`, but does not require the `app_id`. This is meant to be called
after `Branch.init` has been called if you need the session information at a
later point.
If the Branch session has already been initialized, the callback will return
immediately, otherwise, it will return once Branch has been initialized.

___



### first(callback) 

**Parameters**

**callback**: `function`, _optional_ - callback to read the session data.

Returns the same session information and any referring data, as
`Branch.init` did when the app was first installed. This is meant to be called
after `Branch.init` has been called if you need the first session information at a
later point.
If the Branch session has already been initialized, the callback will return
immediately, otherwise, it will return once Branch has been initialized.

___



### setIdentity(identity, callback) 

**Parameters**

**identity**: `string`, _required_ - a string uniquely identifying the user – often a user ID or email address.

**callback**: `function`, _optional_ - callback that returns the user's Branch identity id and unique link.

**[Formerly `identify()`](CHANGELOG.md)**

Sets the identity of a user and returns the data. To use this function, pass
a unique string that identifies the user - this could be an email address,
UUID, Facebook ID, etc.

##### Usage
```js
branch.setIdentity(
    identity,
    callback (err, data)
);
```

##### Callback Format
```js
callback(
     "Error message",
     {
          identity_id:        '12345', // Server-generated ID of the user identity, stored in `sessionStorage`.
          link:               'url',   // New link to use (replaces old stored link), stored in `sessionStorage`.
          referring_data:     { },      // Returns the initial referring data for this identity, if exists.
          referring_identity: '12345'  // Returns the initial referring identity for this identity, if exists.
     }
);
```
___



### logout(callback) 

**Parameters**

**callback**: `function`, _optional_

Logs out the current session, replaces session IDs and identity IDs.

##### Usage
```js
branch.logout(
    callback (err)
);
```

##### Callback Format
```js
callback(
     "Error message"
);
```
___



### close(callback) 

**Parameters**

**callback**: `function`, _optional_

Close the current session.

##### Usage
```js
branch.close(
    callback (err)
);
```

##### Callback Format
```js
callback(
     "Error message"
);
```
___

## Tracking events



### track(event, metadata, callback) 

**Parameters**

**event**: `string`, _required_ - name of the event to be tracked.

**metadata**: `Object`, _optional_ - object of event metadata.

**callback**: `function`, _optional_

This function allows you to track any event with supporting metadata. Use the events you track to create funnels in the Branch dashboard.
The `metadata` parameter is a formatted JSON object that can contain any data and has limitless hierarchy.

##### Usage
```js
branch.event(
    event,
    metadata,
    callback (err)
);
```

##### Callback Format
```js
callback("Error message");
```
___

# Deeplinking Methods

## Creating a deep linking link



### link(linkData, callback) 

**Parameters**

**linkData**: `Object`, _required_ - link data and metadata.

**callback**: `function`, _required_ - returns a string of the Branch deep linking URL.

**[Formerly `createLink()`](CHANGELOG.md)**

Creates and returns a deep linking URL.  The `data` parameter can include an
object with optional data you would like to store, including Facebook
[Open Graph data](https://developers.facebook.com/docs/opengraph).

#### Usage
```
branch.link(
    linkData,
    callback (err, link)
);
```

#### Example
```js
branch.link({
    tags: [ 'tag1', 'tag2' ],
    channel: 'facebook',
    feature: 'dashboard',
    stage: 'new user',
    type: 1,
    data: {
        mydata: 'something',
        foo: 'bar',
        '$desktop_url': 'http://myappwebsite.com',
        '$ios_url': 'http://myappwebsite.com/ios',
        '$ipad_url': 'http://myappwebsite.com/ipad',
        '$android_url': 'http://myappwebsite.com/android',
        '$og_app_id': '12345',
        '$og_title': 'My App',
        '$og_description': 'My app\'s description.',
        '$og_image_url': 'http://myappwebsite.com/image.png'
    }
}, function(err, link) {
    console.log(err, link);
});
```

##### Callback Format
```js
callback(
    "Error message",
    'https://bnc.lt/l/3HZMytU-BW' // Branch deep linking URL
);
```
___

# Referral system rewarding functionality
In a standard referral system, you have 2 parties: the original user and the invitee. Our system is flexible enough to handle rewards for all users for any actions. Here are a couple example scenarios:
1. Reward the original user for taking action (eg. inviting, purchasing, etc)
2. Reward the invitee for installing the app from the original user's referral link
3. Reward the original user when the invitee takes action (eg. give the original user credit when their the invitee buys something)

These reward definitions are created on the dashboard, under the 'Reward Rules' section in the 'Referrals' tab on the dashboard.

Warning: For a referral program, you should not use unique awards for custom events and redeem pre-identify call. This can allow users to cheat the system.

## Retrieve referrals list



### referrals(callback) 

**Parameters**

**callback**: `function`, _required_ - returns an object with referral data.

**[Formerly `showReferrals()`](CHANGELOG.md)**

Retrieves a complete summary of the referrals the current user has made.

##### Usage
```js
branch.referrals(
    callback (err, data)
);
```

##### Callback Format
```js
callback(
    "Error message",
    {
        'install': {
             total: 5,
             unique: 2
        },
        'open': {
             total: 4,
             unique: 3
        },
        'buy': {
            total: 7,
            unique: 3
        }
    }
);
```

---

## Referral Codes



### getCode(data, callback) 

**Parameters**

**data**: `Object`, _required_ - contins options for referral code creation.

**callback**: `function`, _optional_ - returns an error if unsuccessful

Create a referral code using the supplied parameters.  The code can be given to other users to enter.  Applying the code will add credits to the referrer, referree or both.
The data can containt the following fields:
"amount" - A required integer specifying the number of credits added when the code is applied.
"bucket" - The optional bucket to apply the credits to.  Defaults to "default".
"calculation_type" - A required integer.  1 for unlimited uses, 0 for one use.
"location" - A required integer. Determines who get's the credits.  0 for the referree, 2 for the referring user or 3 for both.
"prefix" - An optional string to be prepended to the code.
"expiration" - An optional date string.  If present, determines the date on which the code expires.

##### Usage

branch.getCode(
    data,
    callback(err,data)
);

##### Example

```js
branch.getCode(
    {
      "amount":10,
      "bucket":"party",
      "calculation_type":1,
      "location":2
    }
    callback (err)
);
```

##### Callback Format
```js
callback(
     "Error message",
     {
       "referral_code":"AB12CD"
     } 
);
```
___



### validateCode(code, callback) 

**Parameters**

**code**: `string`, _required_ - the code string to validate.

**callback**: `function`, _optional_ - returns an error if unsuccessful

Validate a referral code before using.

##### Usage

```js
branch.validateCode(
    code, // The code to validate
    callback (err)
);
```

##### Example

```js
branch.validateCode(
    "AB12CD",
    function(err, data) {
        if (err) {
            console.log(err);
        } else {
            console.log("Code is valid");
        }
    }
);
```

##### Callback Format
```js
callback(
    "Error message",
    callback(err, data)
);
```
___



### applyCode(code, callback) 

**Parameters**

**code**: `string`, _required_ - the code string to apply.

**callback**: `function`, _optional_ - returns an error if unsuccessful

Apply a referral code.

##### Usage

```js
branch.applyCode(
    code, // The code to apply
    callback (err)
);
```

##### Example

```js
branch.applyCode(
    "AB12CD",
    function(err, data) {
        if (err) {
            console.log(err);
        } else {
            console.log("Code applied");
        }
    }
);
```

##### Callback Format
```js
callback(
    "Error message",
    callback(err, data)
);
```
___

## Credit Functions



### credits(callback) 

**Parameters**

**callback**: `function`, _required_ - returns an object with credit data.

**[Formerly `showCredits()`](CHANGELOG.md)**

This call will retrieve the entire history of credits and redemptions from the individual user.

##### Usage
```js
branch.credits(
    callback (err, data)
);
```

##### Callback Format
```js
callback(
    "Error message",
    {
        'default': 15,
        'other bucket': 9
    }
);
```

---



### creditHistory(data, callback) 

**Parameters**

**data**: `Object`, _optional_ - options controlling the returned history.

**callback**: `function`, _required_ - returns an array with credit history data.

This call will retrieve the entire history of credits and redemptions from the individual user.

##### Usage

```js
branch.creditHistory(
     data,
     callback(err, data)
);

##### Example

```js
branch.creditHistory( 
    {
      "length":50,
      "direction":0,
      "begin_after_id:"123456789012345",
      "bucket":"default"
    }
    callback (err, data)
);
```

##### Callback Format
```js
callback(
    "Error message",
[
    {
        "transaction": {
                           "date": "2014-10-14T01:54:40.425Z",
                           "id": "50388077461373184",
                           "bucket": "default",
                           "type": 0,
                           "amount": 5
                       },
        "referrer": "12345678",
        "referree": null
    },
    {
        "transaction": {
                           "date": "2014-10-14T01:55:09.474Z",
                           "id": "50388199301710081",
                           "bucket": "default",
                           "type": 2,
                           "amount": -3
                       },
        "referrer": null,
        "referree": "12345678"
    }
]
);
```

---

## Credit redemption



### redeem(amount, bucket, callback) 

**Parameters**

**amount**: `number`, _required_ - an `amount` (int) of number of credits to redeem

**bucket**: `string`, _required_ - the name of the `bucket` (string) of which bucket to redeem the credits from

**callback**: `function`, _optional_ - returns an error if unsuccessful

**[Formerly `redeemCredits()`](CHANGELOG.md)**

Credits are stored in `buckets`, which you can define as points, currency, whatever makes sense for your app. When you want to redeem credits, call this method with the number of points to be redeemed, and the bucket to redeem them from.

##### Usage

```js
branch.redeem(
    amount, // amount of credits to be redeemed
    bucket,  // String of bucket name to redeem credits from
    callback (err)
);
```

##### Example

```js
branch.redeem(
    5,
    "Rubies",
    function(err) {
        console.log(err);
    }
);
```

##### Callback Format
```js
callback("Error message");
```
___




* * *










## Bugs / Help / Support

Feel free to report any bugs you might encounter in the repo's issues. Any support inquiries outside of bugs 
please send to [dmitri@branch.io](mailto:dmitri@branch.io).