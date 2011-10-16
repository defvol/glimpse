/**
 * Feed parser 
 * -----------
 * @author Rodolfo Wilhelmy (rod@teiga.mx)
 * @copyright TEIGA (http://www.teiga.mx)
 * @version 0.8
 * @updated 06-APR-11
 *
 **/


/* SETUP */


function resetGlobals() {
	screen = screenMachine.THEGRID;
	indexesToBeRemoved = [];
	addQueue = [];
	modifyQueue = [];
	today = new Date();
	hideContentArea();
	// CLEAR search box
	$(document.getElementById('searchBox')).val('');
}

var ENTRIES_PER_FEED = 10;

var extractionMethods = {
	description: 1,
	enclosure: 2,
	linkRel: 3,
	mediaContent: 4,
	mediaThumbnail: 5,
	contentEncoded: 6
};


/* DATA STORAGE */


// Array of story objects
var stories = [];
// Array of story objects to be stored offline (no image included)
var local_stories = [];
// Last insertion index for stories in current feed (initialized by parseFeed)
var lastInsertionIndex;
// Last inserted story for this feed (initialize by parseFeed)
var lastInsertedStory;

// Inserts story in array sorted by date, @returns index of insertion
function saveStory(story) {
	// If we can't sort element just push it
	if (isNaN(story.date.getTime())) {
		stories.push(story);
		return stories.length - 1;
	}

	// Avoid comparing each item from the beginning if feed is sorted by date
	if (lastInsertedStory && lastInsertedStory.date > story.date)
		var i = lastInsertionIndex + 1;
	else
		var i = 0;
					
	// Find index where the story will be inserted
	while (i < stories.length && stories[i].date > story.date) i++;		
	// Insert without deleting http://bit.ly/hLupJY
	stories.splice(i, 0, story);
	// Save inserted story to detect unsorted feeds
	lastInsertedStory = story;
	
	return i;
}

// Returns a new feed object
function newFeedObject(title, url, status, imageLocation) {
	var newFeed = {};
	var parsedStatus = parseInt(status);
	var pImageLocation = parseInt(imageLocation);
	
	newFeed.title = (title)? title : "Unknown";
	newFeed.url = (url)? url : "Bad URL";
	newFeed.status = isNaN(parsedStatus)? 0 : (!parsedStatus? 0 : 1);
	newFeed.imageLocation = isNaN(pImageLocation)? -1 : pImageLocation;
	
	return newFeed;
}


/* LOADING AND PARSING */


var remainingFeeds = 0;

// RETRIEVE each feed	
function loadFeeds() {
	hideLoading();

	resetGlobals();
	var feed;
	
	if (!feedList.length) {
		// Show helper image
		$('#sourcesHelper').css('visibility','visible');
	} else {
		// BEFORE downloading sources, disable reloadButton and show loading spinner
		$('#reloadButton').attr('disabled', 'disabled');
		$('#headerTools #feedsLoading').show();
	}
	
	// SET feeds counter
	remainingFeeds = feedList.length;
	
	for (var i = 0; i < feedList.length; i++) {
		if (googleReaderMode) {
			qnx.callExtensionMethod("greader.items", feedList[i].url, ENTRIES_PER_FEED, "parseFeed");
		} else {
			feed = new google.feeds.Feed(feedList[i].url);
			feed.setResultFormat(google.feeds.Feed.MIXED_FORMAT);
			feed.setNumEntries(ENTRIES_PER_FEED);
			feed.load(parseFeed);		
		}
	}
}

function parseFeed(result) {
	// DECREASE counter, when we reached 0 we stop the spinner and enable reloadButton
	remainingFeeds--;

	// When all sources have arrived, ENABLE reloadButton and HIDE spinner
	if (!remainingFeeds) {
		$('#reloadButton').removeAttr("disabled");
		$('#headerTools #feedsLoading').hide();
	}
	
	if (!result || result.error || typeof result == "string") return;

	// RETRIEVE channel (a.k.a feed) info
	var feed_url = result.feed.feedUrl;
	var feed_id = getFeedIndexForFeedURL(feed_url);
	// TODO - if feed_id = -1 what would happen?
	var saved_feed_name = feedList[feed_id].title;
	var feed_name = (saved_feed_name)? saved_feed_name : result.feed.title;
	var feed_method = feedList[feed_id].imageLocation;
		
	// DETECT new feeds and initialize votes array
	if (feed_method < 0) {
		// Show helper image
		$('#updateHelper').css('visibility','visible');
		// INITIALIZE variables used by paparazzi
		itemId = 0;
		votes[feed_id] = [];
		// votes = [ [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], ... ]
		// TODO - zeroOut second param should be a constant (size of methods array)
		zeroOutArrayWithSize(votes[feed_id], 7);
		// voters left on each feed = to number of items, e.g. [10,5,0,10]
		voters[feed_id] = result.feed.entries.length;
	}
	
	// CLEAR stories array and news grid when receiving the first source
	if (remainingFeeds == feedList.length - 1) { 
		stories = [];
		local_stories = [];
		$('div#page ul#cellArea li').remove();
		// And hide the loading dialog
		$('#loadingPlaceholder').css('display','none');
	}
	// BUILD story objects
	var story, local_story;
	// For every story object save its newly created cell and its grid index
	var insertionIndexes = [], newCells = $();
	
	$(result.feed.entries).each(function () {
		story = {
			title: this.title,
			link: this.link,
			id: this.id,
			source: feed_name,
			source_url: feed_url,
			labels: this.labels,
			content: this.content,
			date: (new Date(this.publishedDate)),
			img: getImageUsingExtractionMethod(this, feed_method, feed_url, feed_id)
		};
		
		local_story = {
			title: story.title,
			link: story.link,
			source: story.source,
			source_url: story.source_ul,
			content: story.content
		};
		
		local_stories.push(local_story);
				
		// SAVE story and get starting index for the next comparisons
		lastInsertionIndex = saveStory(story);
		// REMEMBER cell POSITION in the grid
		insertionIndexes.push(lastInsertionIndex);
		// BUILD a new cell for this item
		newCells = $(newCells).add(getHtmlForStory(story));
	});

	// INSERT cells into DOM
	$(newCells).each(function() {
		lastInsertionIndex = insertionIndexes.shift();
		if (lastInsertionIndex) {
			// Insert AFTER <li> but avoid overflow cases (i.e. lastInsertionIndex > ('li's).length)
			$("#cellArea li").eq(lastInsertionIndex - 1).after(this);		
		} else {
			if (!$("#cellArea li").length) {
				// If there's no <li> elements, append first <li>
				$(document.getElementById('cellArea')).append(this);
			} else {
				// Insert BEFORE first <li>
				$("#cellArea li").eq(lastInsertionIndex).before(this);			
			}				
		}
	});
	
	// Add handler to remove broken images
	$(newCells).children('img').error(function() {
		$(this).parent().addClass('textOnlyCell');
		$(this).remove();
	});
	
	newCells = null;
		
	// SET feed status as OK
	feedList[feed_id].status = 1;
	// CLEAR insertion index for next feed sort operation
	lastInsertionIndex = 0;
	// CLEAR last inserted story for next feed sort operation
	lastInsertedStory = null;
	
	// Save stories in local storage
	localStorage.stories = JSON.stringify(local_stories);
}


// Since each story has a different source in this case, this method avoids feedList logic done in parseFeed
function parseGoogleLabeledItems(result) {
	$('#headerTools #feedsLoading').hide();

	if (!result || result.error || typeof result == "string") return;
				
	var story, newCells = $(), entries = result.feed.entries, feed_id, feed_method;

	if (entries.length == 0) { 
		alert('Could not find items labeled as ' + result.feed.label);
		return;
	}
	
	for (var i = 0; i < entries.length; i++) {
		if (i == 0) {
			// CLEAR grid
			$(document.getElementById('cellArea')).html('');
			// CLEAR stories' array
			stories = [];
		}
	
		story = entries[i];
		story.date = new Date(story.publishedDate);

		feed_id = getFeedIndexForFeedURL(story.source_url);

		// For unknown feeds, use mediaGroup (4) or article content (1) as image location
		if (feed_id == -1)
			feed_method = (story.mediaGroups[0].contents.length)? 4 : 1;
		else
			feed_method = feedList[feed_id].imageLocation;

		story.img = getImageUsingExtractionMethod(story, feed_method, story.source_url, feed_id);

		stories.push(story);		
		newCells = $(newCells).add(getHtmlForStory(story));		
	}
		
	// INSERT cells into DOM
	$(document.getElementById('cellArea')).append(newCells);
	$(newCells).children('img').error(function() {
		$(this).parent().addClass('textOnlyCell');
		$(this).remove();
	});	
}


// Offline mode
function loadOfflineStories() {

	if (!localStorage.stories) return;
	
	stories = JSON.parse(localStorage.stories);
	
	var cells = $();

	// BUILD new cells for every story
	$(stories).each(function () {
		cells = $(cells).add(getHtmlForStory(this));		
	});

	// INSERT cells into DOM
	$(document.getElementById('cellArea')).append(cells);
	
	// Add handler to remove broken images
	$(cells).children('img').error(function() {
		$(this).parent().addClass('textOnlyCell');
		$(this).remove();
	});

}


/* IMAGE EXTRACTION */


function getImageUsingExtractionMethod(item, aMethod, feed_url, feed_id) {
	var img;
	switch(aMethod) {
		case extractionMethods.description:
			img = extractImageFromDescription(item.content);
			break;
		case extractionMethods.enclosure:
			img = extractImageFromEnclosure(item.xmlNode);
			break;
		case extractionMethods.linkRel:
			img = extractImageFromLinkRels(item.xmlNode);
			break;
		case extractionMethods.mediaContent:
			img = extractImageFromMediaContent(item.mediaGroups);
			break;
		case extractionMethods.mediaThumbnail:
			img = extractImageFromMediaThumbnail(item.xmlNode);
			break;
		case extractionMethods.contentEncoded:
			img = extractImageFromContentEncoded(item.xmlNode);
			break;
		default:
			// Run paparazzi algorithm on new feeds
			img = paparazzi(item, feed_url, feed_id);		
			break;
	}

	return img;
}

// <p>Lorem ipsum <img src="http://www..." /> more content </p>
function extractImageFromDescription(description) {
	try {
		var found = $(description).find('img[src]').not(':fakeImage');
		if (found.length < 1) return null;
		found = (found.length > 1)? selectBestImageInArray(found) : found;
	
		var src = $(found).attr('src');
		var wid = $(found).attr('width');
		var hei = $(found).attr('height');

		return buildImageElementWithAttributes(src, wid, hei);
	} catch (e) { }
}

// <enclosure url="http://.../view/663808/preview" length="20913" type="image/jpeg" />
function extractImageFromEnclosure(xml) {
	var found = $(xml).find('enclosure[url][type^="image/"]');
	if (found.length < 1) return null;
	found = (found.length > 1)? selectBestImageInArray(found) : found;
	
	var src = $(found).attr('url');
	var wid = $(found).attr('width');
	var hei = $(found).attr('height');

	return buildImageElementWithAttributes(src, wid, hei);
}

// <link rel="enclosure" type="image/jpeg" title="AP" href="http://hosted2.ap.org/...MTHw%3d%3d" />
function extractImageFromLinkRels(xml) {
	var found = $(xml).find('link[rel="enclosure"][type^="image/"][href]');
	if (found.length < 1) return null;
	found = (found.length > 1)? selectBestImageInArray(found) : found;
	
	var src = $(found).attr('href');
	var wid = $(found).attr('width');
	var hei = $(found).attr('height');

	return buildImageElementWithAttributes(src, wid, hei);
}

function extractImageFromMediaContent(mediaGroups) {
	if (mediaGroups == null) return null;
	var contents = mediaGroups[0].contents;
	if (contents == null || contents.length == 0) return null;
	contents = (contents.length > 1)? selectBestImageInArray(contents) : contents;	
		
	var src = (jQuery.isArray(contents))? contents[0].url : contents.url;
	var wid = (jQuery.isArray(contents))? contents[0].width : contents.width;
	var hei = (jQuery.isArray(contents))? contents[0].height : contents.height;

	return buildImageElementWithAttributes(src, wid, hei);
}

// <media:thumbnail width="66" height="49" url="http://51468469.jpg"/>
function extractImageFromMediaThumbnail(xml) {
	var found = $(xml).find('thumbnail[url]');
	if (found.length < 1) return null;
	found = (found.length > 1)? selectBestImageInArray(found) : found;
	
	var src = $(found).attr('url');
	var wid = $(found).attr('width');
	var hei = $(found).attr('height');

	return buildImageElementWithAttributes(src, wid, hei);
}

// <content:encoded><![CDATA[<p><img src="./253525404.jpg?w=300&#038;h=224" width="300" />For reasons</p>
function extractImageFromContentEncoded(xml) {
	var found = $($(xml).find('encoded').text()).find('img[src]').not(':fakeImage');
	if (found.length < 1) return null;
	found = (found.length > 1)? selectBestImageInArray(found) : found;
	
	var src = $(found).attr('src');
	var wid = $(found).attr('width');
	var hei = $(found).attr('height');

	return buildImageElementWithAttributes(src, wid, hei);	
}


/* UTILITIES */


function getFeedIndexForFeedURL(url) {
	for (var i = 0; i < feedList.length; i++)
		if (feedList[i].url == url) return i;
	return -1;
}

function urlPointsToImage(url) {
	return (url != null && url.search(/(.png|.jpg|.jpeg)/i) > -1)? true : false;
}

function imageHasSizeAttributes(i) {
	// In case we receive a jQuery set or a HTMLImageElement - we parseInt because attr() returns string
	var w = parseInt($(i).attr('width'));
	var h = parseInt($(i).attr('height'));
	// Parsing something that isn't a number results in NaN
	// Check also if width and height are bigger than 0 (browser assign 0 values when attr don't exist)
	return (!isNaN(w) && !isNaN(h) && (w || h));
}

// Returns an array containing width and height for an image
function getImageSize(i) {
	if (!i) return {width:0, height:0};

	var w = parseInt($(i).attr('width'));
	var h = parseInt($(i).attr('height'));

	w = isNaN(w) ? 0 : w;
	h = isNaN(h) ? 0 : h;
	
	return {width:w, height:h};
}

function selectBestImageInArray(images) {
	// A temporary <img> with src and attr greater than 0 to avoid breaking comparisons and size validations
	var best = buildImageElementWithAttributes("images/teigaLogo.png", 1, 1);

	// Compare images and find the best
	for (var i = 0, comparison; i < images.length; i++) {
		comparison = imageCompare(best, images[i]);
		// If comparison failed skip non-comparable image
		if (!comparison) continue;
		// Otherwise select a winner
		best = (comparison < 0) ? best : images[i];
		// Sayonara if we find something good enough 
		if (isImageOk(best)) break;
	}

	// If all comparisons failed return first image
	return ($(best).attr('src') == "images/teigaLogo.png") ? images[0] : best;
}

// @returns -1 when a is bigger than b or +1 otherwise
function imageCompare(a, b) {
	// @returns 0 if can't compare
	if ( (!imageHasSizeAttributes(a)) || (!imageHasSizeAttributes(b)) ) return 0;
	
	// Always compare using the largest measure
	var a_size = getImageSize(a);
	var a_measure = (a_size.width > a_size.height) ? a_size.width : a_size.height;
	var b_size = getImageSize(b);
	var b_measure = (b_size.width > b_size.height) ? b_size.width : b_size.height;

	return (a_measure >= b_measure)? -1 : 1;	
}

function buildImageElementWithAttributes(src, width, height) {
	if (!src) return null;
	
	var img = $('<img>').attr('src', src);	
	if (width) $(img).attr('width', width);	
	if (height) $(img).attr('height', height);

	return img;	
}

// Used to clean content area when reading a story
function cleanContentInContainer(container) {
	$(container + ' img:fakeImage').remove();
	$(container + ' a:empty').remove();
	$(container + ' a').click(function(event) {
		event.preventDefault();
	});
	$(container + ' iframe').remove();
	$(container + ' script').remove();
}

// Global date object (initialize in loadFeeds)
var today;

// How recent is the story?
function storyFreshness(dateObject) {
	if (!dateObject) return "";
	if (isNaN(dateObject.getTime())) return "";
	if (!today) today = new Date();
	
	// getTime() returns milliseconds
	// RETURN number of minutes
	var timePassed = (today.getTime() - dateObject.getTime()) / (1000*60);
	if (timePassed < 60)
		return parseInt(timePassed) + "m ago";
	// RETURN number of hours
	timePassed /= 60;
	if (timePassed < 24)
		return parseInt(timePassed) + "h ago";
	// RETURN number of days
	return parseInt(timePassed /= 24) + "d ago";
	
}


/* DISPLAY */


var cellCounter = 0;

function getHtmlForStory(story) {
	var image = $(story.img);
	
	if(image.attr('src') == null) {
		return $('<li></li>').append(
			"<a href='#' class='target'> </a>" +
			"<span class='title'>" + story.title + "<i> - " + story.source + "</i></span>"
		).addClass('textOnlyCell');
	} else {
		var imageWidth = image.attr('width');
		var imageHeight = image.attr('height');
		imageWidth = isNaN(imageWidth)? 0:imageWidth;
		imageHeight = isNaN(imageHeight)? 0:imageHeight;		
		var cellWidth = 234; // Change for dynamic cell size
		var cellHeight = 171; // Change for dynamic cell size
		var widthFactor = imageWidth / cellWidth;
		var heightFactor = imageHeight / cellHeight;
		var scaling;
		var center;
		var centerAmount;
		
		// Choose scaling
		var scalingDimension;
		if (!widthFactor && heightFactor) // width = 0 means auto-width
			scalingDimension = 'height';
		else if (!heightFactor && widthFactor) // e.g. 400xN
			scalingDimension = 'width';
		else if (widthFactor <= heightFactor) // scale to smallest dimension
			scalingDimension = 'width';
		else
			scalingDimension = 'height';
		
		// Set scaling style
		if (scalingDimension == 'width') {
			scaling = 'width';
			center = 'top';
			centerAmount = cellHeight/2 - imageHeight/2;
		} else {
			scaling = 'height';
			center = 'left';
			centerAmount = cellWidth/2 - imageWidth/2;
		}
	
		return $('<li>').append(
			"<img src='" + $(image).attr('src') + "' " + scaling + "=100% " + center + "=" + centerAmount + "px >" +
			"<a href='#' class='target'> </a>" +
			"<span class='title'>" + story.title + "<i> - " + story.source + "</i></span>"
		);
	
	}
}


/* TODO */


function extractImageFromXmlUsingSelector(xml, selector) {
	// $(xml).find('link[rel="enclosure"][type^="image/"][href]');
}

