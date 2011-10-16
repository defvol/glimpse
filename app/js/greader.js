/**
 * Google Reader Callbacks 
 * -----------------------
 * @description Here we handle callbacks done by our Google Reader Client over Adobe AIR
 * @author Rodolfo Wilhelmy (rod@teiga.mx)
 * @copyright TEIGA (http://www.teiga.mx)
 * @created 28-JUN-11
 *
 **/


function gLogin(data) {
	// Stop loading animation
	$('div#menuBar #loginFormContainer img#googleLoading').hide();
	// Enable login button
	$('#loginFormContainer #loginFormFooterRight #googleFormSubmit').attr('disabled', '');
	
	if (data == "OK" || data == "Error: already logged in") {
		googleReaderMode = true; 
		localStorage.googleReaderMode = true;
		$(".toggleUI").trigger("loggedIn");
		if (data == "OK") 
			data = 'Downloading subscriptions';		
		qnx.callExtensionMethod("greader.subscriptions", "gFeeds");
		qnx.callExtensionMethod("greader.user", "gUser");		
	}	

	// Change loading status (OK, Bad authentication, Already logged in)
	$('div#menuBar #loginFormContainer div#loginFormFooterLeft span').html(data);
}


function gFeeds(result) {
	var data, subscriptions, msg = '';
		
	try {
		data = JSON.parse(result);
		subscriptions = data.subscriptions;

		// Save glimpse's feedList
		if (feedList.length && feedList[0].google != true) {
			feedListBackup = feedList;
			localStorage.feedListBackup = JSON.stringify(feedList);						
		}
		
		// Before clearing feedList try to save image locations
		var savedLocations = [], savedUrls = [];		
		for (var i = 0; i < feedList.length; i++) {
			savedLocations.push(feedList[i].imageLocation);
			savedUrls.push(feedList[i].url);
		}
		
		// Overwrite current feedList with Google sources
		feedList = [];

		// Will push a new feed source, removing "feed/" prefix from feed id to get feed's URL
		var subURL = "", indexOfSavedLocation = -1, recycledImageLoc = -1;
		for (var i = 0; i < subscriptions.length; i++) {
			subURL = subscriptions[i].id.substr(5);
			// Check if subscription URL is in the saved list
			indexOfSavedLocation = jQuery.inArray(subURL, savedUrls);
			// Use the previously found image location for this source
			if (indexOfSavedLocation != -1) recycledImageLoc = savedLocations[indexOfSavedLocation];
			// Only if it's equal to 1 (content) or 4 (mediaGroups), i.e. locations defined by the gReader plugin.
			// Thus avoiding a possible conflict when we search for images in locations unknown for our gReader item
			// E.g. notcot's images in gReader mode could be in method:4 and in method:2 for glimpse mode.
			// In this case, if the last feedList was glimpe's we shouldn't use that location for gReaderMode.
			// And we must set the location as undefined (-1) so the imageExtraction algorithm can find the location.
			// On the other case, if the last feedList was google's we can go ahead and recycle the location (4 in this example).
			if (recycledImageLoc != 1 && recycledImageLoc != 4) recycledImageLoc = -1;
			
			var nextGoogleFeed = newFeedObject(subscriptions[i].title, subURL, 0, recycledImageLoc);
			nextGoogleFeed.google = true;			
			feedList.push(nextGoogleFeed);
		}

		localStorage.feedList = JSON.stringify(feedList);
		msg = 'Downloaded ' + subscriptions.length + ' subscriptions';
		
		setLoading('Downloading Google news');
		showLoading();
		loadFeeds();
	} catch (e) {
		msg = 'Could not retrieve subscriptions.';
	}

	// Operation status
	$('div#menuBar #loginFormContainer div#loginFormFooterLeft span').html(msg);
}


function gUser(result) {
	var json, msg = '';
	
	try {
		json = JSON.parse(result);
		msg = 'Hi ' + json.userName;
	} catch (e) {
		msg = result;
	}

	// Operation status
	$('div#menuBar #loginFormContainer div#loginFormFooterLeft span').html(msg);
}


function gAdd(result) { if (result != "OK") alert(result); }


function gDel(result) { if (result != "OK") alert(result); }


function gFav(result) { 
	$('#social_nav_horizontal ul li.star').attr('disabled', '');
	if (result != "OK")
		alert(result);
	else
		toggleLabel("starred");	
}


function gUnread(result) {
	$('#social_nav_horizontal ul li.unread').attr('disabled', '');
	if (result != "OK")
		alert(result);
	else
		toggleLabel("kept-unread");
}


// Update property "labels" for a modified story object.
// TODO - this may cause a bug, if the user moves to another story before Google's response.
function toggleLabel(label) {
	var gId = $('#contentArea').data('story-data').gId;
	for (var i = 0; i < stories.length; i++) {
		if (stories[i].id == gId) {
			var index = jQuery.inArray(label, stories[i].labels);
			if (index == -1)
				stories[i].labels.push(label);
			else
				stories[i].labels.splice(index, 1);			
		}
	}
}


function gRead(result) {
	if (result != "OK") {
		alert(result);
		return;
	}

	var gId = $('#contentArea').data('story-data').gId;
	for (var i = 0; i < stories.length; i++)
		if (stories[i].id == gId && jQuery.inArray("read", stories[i].labels) == -1)
			stories[i].labels.push("read");
}


