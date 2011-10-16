// Global variables

var menuVisible = false;
var feedsToggled;
var contentAreaVisible = false;
var searchBoxContent;
var screen;
var screenMachine = {
	THEGRID : 0,
	MYFEEDS : 1,
	READMORE : 2,
	CONTENTAREA : 3
};
var googleReaderMode = false;
var mostRecentSearchQuery;
var indexesToBeRemoved = [];
var addQueue = [];
var modifyQueue = [];
// Holds current feedList, either glimpse's or google's
var feedList = [];
// Will save glimpse's feedList when googleReaderMode is ON
var feedListBackup = [];
var defaultFeedList = [
	{ "title":"Engadget","url":"http://www.engadget.com/rss.xml","status":0,"imageLocation":1 },
	{ "title":"NOTCOT.ORG","url":"http://www.notcot.org/atom.php","status":0,"imageLocation":1 }
];
var contentAreaFontSize;
var google;
var ScriptInjector = {};
var analytics_url = "http://analytics.glimpse.dotcloud.com/";
var country_code = "XX";

$(document).ready(function() {
	// Retrieved cached feedList
	if (localStorage.feedList) feedList = JSON.parse(localStorage.feedList);
	
	// Initial styling and event binding
	UISetup();
	GReaderUISetup();
	
	// Initialize Google Reader Plugin
	qnx.callExtensionMethod("greader");
	
	// Check if still there's an active Google session.
	if (localStorage.googleReaderMode != "undefined" && localStorage.googleReaderMode === 'true') {
		googleReaderMode = true;
		gLogin("OK"); // update UI and subscriptions
	}

	// LOAD Google API
	var key = 'ABQIAAAA6hi9qZbgUPpFdGjX44jK7RQBprDYVLUrV51WU4Kz304NDhcMaBS6gCMpnp_VoaSZcQq_rzoMpysmcQ';
	ScriptInjector.load('https://www.google.com/jsapi?key=' + key + '&callback=loadGoogleFeedAPI', ScriptInjectorHandler);
	
	// DOWNLOAD country code
	qnx.callExtensionMethod("countrycode");	
});




// --------------------------------------------------------------------------------------- //
// 								SCRIPT INJECTION
// --------------------------------------------------------------------------------------- //




ScriptInjector.scripts = [];
ScriptInjector.load = function(url, callback) {
	if (callback == null) return;

	try {
		// Make sure we only insert the script once
		if (ScriptInjector.scripts.indexOf(url) == -1) {
			// A note to remember that we already loaded this script
			ScriptInjector.scripts.push(url);
			
			// Add script tag to head element
			var script = document.createElement("script");
			script.src = url;
			script.type = "text/javascript";
			document.getElementsByTagName('head')[0].appendChild(script);

			// Show loading status
			setLoading('Loading scripts');
			showLoading();

			// Handle script error
			script.onerror = function () {
				var msg = 'Failed to load ' + url;
				callback(msg);
				console.log(msg);
				return;
			}
		} else {
			callback();
		}
	} catch (e) {
		// Couldn't inject script
		callback(e);
		console.log(e);
	}
}

function ScriptInjectorHandler(error) {
	hideLoading();

	if (error) {
		if (typeof blackberry !== 'undefined') {
			try {
				var buttons = new Array("exit app", "close dialog");
				var ops = {
					title : "Connection issue", 
					size : blackberry.ui.dialog.SIZE_SMALL, 
					position : blackberry.ui.dialog.LOC_CENTER
				};		
				blackberry.ui.dialog.customAskAsync("Please check your network connection.", buttons, dialogCallback, ops);
			} catch(e) {
 				alert("Please check your network connection.");
 			}
		} else {
			alert('Please check your network connection.');
			loadOfflineStories();
		}
		
		return;
	}

	// TODO
	// Operations after script is loaded	
}




// --------------------------------------------------------------------------------------- //
// 								GOOGLE FEEDS
// --------------------------------------------------------------------------------------- //




window.loadGoogleFeedAPI = function() {
	hideLoading();
	google.load("feeds", "1", {"callback" : fetchFeeds});
}


// FIND the list of feeds in local storage, otherwise download featured sources
function fetchFeeds() {
	// If we are on googleReaderMode, loadFeeds will be invoked by gLogin("OK") and gSubs
	if (googleReaderMode) return;

	if (feedList && feedList.length) {
		setLoading('Downloading latest news');
		showLoading();
		loadFeeds();			
	} else {
		setLoading('Obtaining featured sources');
		showLoading();
		$.ajaxSetup({ timeout: 5000 });
		$.getJSON('http://teiga.mx/bb/glimpse/getFeaturedSources.php?callback=?', function(sources) {
			feedList = ($.isArray(sources) && sources.length) ? sources : defaultFeedList;			
			localStorage.feedList = JSON.stringify(feedList);
			setLoading('Downloading latest news');
			loadFeeds();
		}).error(function() {
			loadDefaultSources();
		});
	}
}


function loadDefaultSources() {
	feedList = defaultFeedList;
	localStorage.feedList = JSON.stringify(feedList);
	setLoading('Downloading latest news');
	loadFeeds();
}




// --------------------------------------------------------------------------------------- //
// 								UI SETUP
// --------------------------------------------------------------------------------------- //




function UISetup() {
	fixElementSizes();

	$(window).resize(function() {
		fixElementSizes();
	});	
	
	setHandlers();
	
	// TODO verify if necessary
	// Prevent default touch behavior inside contentArea
	document.getElementById('contentOverlay').ontouchmove = function(e) {
		//e.preventDefault();
		e.stopPropagation();
	}
	
	document.getElementById('contentOverlay').ontouchstart = function(e) {
		//e.preventDefault();
		e.stopPropagation();
	}
	
	document.getElementById('contentOverlay').ontouchend = function(e) {
		//e.preventDefault();
		e.stopPropagation();
	}

	// When typing inside searchBox, call search or filter methods depending on current screen
	$('#searchBox').keyup(function(key) { 
    	var val = this.value;
    	if(screen === screenMachine.MYFEEDS) {
			search(val);
		} else if (screen === screenMachine.THEGRID) {		
			filter(val);
		}  		
	});
	
	// When searchbox is in focus, change searchBar border for UI feedback
	$('#searchBar, #loginFormContainer .textBar').focusin(function() {
		$(this).addClass('focused');
	}).focusout(function() {
		$(this).removeClass('focused');
	});
	
	// ---  Setting button actions --- //
	
	$('#doneButton').click(saveChanges);
	
	$('#cancelButton').click(function() {
		discardChanges();	
	});
	
	$('#closeReadMore').click(function() {
		hideReadMore();	
	});
	
	$('#invokeBrowserButton').click(function() {
		followLink($('#readMoreFrame').attr('src'));
	});
	
	$('#teigaLogo').click(function() {
		followLink("http://glimpse.teiga.mx");
	});
	
	// Shows the feedList when the RSS icon is clicked
	$('#feedsButton').click(function() {
		if(screen === screenMachine.MYFEEDS) {
			// Do nothing
		} else { 
			showEditMode();
		}
		readFeedArray();
	});
	
	// Reload cells or show search results depending on current screen
	$('#reloadButton').click(function() {
		if(screen === screenMachine.MYFEEDS) {
			search($('#searchBox').val());
		} else if (screen === screenMachine.THEGRID) {
			if ($(this).attr('disabled') != 'disabled') {
				loadFeeds();
				// Hides helper image
				$('#updateHelper').css('visibility','hidden');					
			}
		}
	});
		
	// Invokes new feed popup
	$('#newFeedButton').click(function() {
		$('#mFeedPlaceholder #mFeedContainer #txtFields input').val("");
		$('#mFeedPlaceholder').css('display','block');
		$('#mFeedPlaceholder #mFeedContainer #error').css('display','none');
	});
	
	$('#mFeedPlaceholder #mFeedContainer #buttons #cancel').click(function() {
		// Close dialog
		$('#mFeedPlaceholder').css('display','none');
	});

	$('#mFeedPlaceholder #mFeedContainer #buttons #save').click(function() {
		// Hide error message
		$('#mFeedPlaceholder #mFeedContainer #error').css('display','none');
		// Get text-field values
		var title = $('#mFeedPlaceholder #mFeedContainer #txtFields #txtName').val();
		var url = $('#mFeedPlaceholder #mFeedContainer #txtFields #txtUrl').val();

		// Will be set to false if URL already exists in local storage or in 'to be added'
		var valid_url = true;
		// Validate empty text fields
		if(title.length < 1|| url.length < 1) {
			valid_url = false;
			$('#mFeedPlaceholder #mFeedContainer #error').html("Please fill in both a URL and a NAME for the feed.");
		} else {
			$(addQueue).add(feedList).each(function() {
				if (this.url == url) {
					valid_url = false;
					$('#mFeedPlaceholder #mFeedContainer #error').html("You already have a feed with that URL.");
					return;
				}
			});
		}
		
		
		// Do not save repeated sources
		if (!valid_url) {
			$('#mFeedPlaceholder #mFeedContainer #error').css('display','block');
			return;
		}

		// Insert sources in 'to be added' queue 
		var manual_feed = newFeedObject(title, url);		
		addQueue.push(manual_feed);
		// Refresh feed list screen
		readFeedArray();
		// Close dialog
		$('#mFeedPlaceholder').css('display','none');
	});
	
	// Close contentArea button action
	$('#navigationBar #closeContentArea').bind('click', hideContentArea);
	
	// Previous article button action
	$('#navigationBar ul li.previousArticle').bind('click', function(event) {
		setContentForId($('#contentArea').data('story-data').previous);
	});
	
	// Next article button action
	$('#navigationBar ul li.nextArticle').bind('click', function(event) {
		setContentForId($('#contentArea').data('story-data').next);
	}); 
	
	// Font size button action
	$('#social_nav_horizontal ul li.fontSize').bind('click', changeFontSize);
	
	// Read More Link action
	$('#social_nav_horizontal ul li.readMore').bind('click', function(event) {
		// Close currently open menu bar
		toggleMenuBar();
		showReadMore($('#contentArea').data('story-data').link);
	}); 
	
	// Browser invoke Link action
	$('#social_nav_horizontal ul li.browser').bind('click', function(event) {
		followLink($('#contentArea').data('story-data').link);
	});
	
	// Setup Facebook functionality
	facebookSetup();
	
	// Twitter Link action
	$('#social_nav_horizontal ul li.twitter').bind( 'click', function(event) {
		var story_data = $('#contentArea').data('story-data');
		var link = story_data.link;
		
		// Analytics
		$.getJSON(analytics_url + "shared?u=" + encodeURI(link) + "&s=twitter&callback=?", function() {});
		
		var post_url = "http://twitter.com/share?text=" + story_data.title + "&url=" + link + "&via=glimpse_app";
		// Invoke BlackBerry browser
		followLink(post_url);
	});
		
	// Custom selectors to remove banners and ads
	$.expr[':'].fakeImage = function(obj) {
		return !urlPointsToImage($(obj).attr('src'));
	};
	
	$.expr[':'].empty = function(obj) {
		return $(obj).text().length == 0;
	};
	
	// Bind event to vote for best image extraction methods
	$('#hiddenImages').bind('vote', voteForExtractionMethod);
	
	// Live events for grid cells
	$("ul#cellArea > li").live('click', selectCell);
	$("ul#cellArea > li img").live('error', function() {
		$(this).parent().addClass('textOnlyCell');
		$(this).remove();		
	});
	
	// When there is no feedList in local storage
	if (!localStorage.feedList) {
		// Show helper images
		$('#updateHelper').css('visibility','visible');
		$('#sourcesHelper').css('visibility','visible');
	}
	
	// Check local storage for user set font size and set it if it exists
	if (localStorage.fontSize) {
		contentAreaFontSize = localStorage.fontSize;
		$('#contentArea').css('font-size', contentAreaFontSize);
	}
	
}

// Extension of the "contains" selector to make it case insensitive
jQuery.expr[':'].Contains = function(a,i,m){
	return (a.textContent || a.innerText || "").toLowerCase().indexOf(m[3].toLowerCase())>=0;
};

window.onorientationchange = function() 
{
    var orientation = window.orientation;
    switch(orientation) {
        case 0:
        	// Default landscape orientation
            break; 
        case -90:
            // Left side up (portrait)
            break;
        case 90: 
            // Right side up (portrait)
            break;
        case 180: 
            // Upside down landscape orientation
            break;
    }
    fixElementSizes();
}




// --------------------------------------------------------------------------------------- //
// 								UI SETUP (GOOGLE READER MODE)
// --------------------------------------------------------------------------------------- //




function GReaderUISetup() {

	// Google reader starred items filter button
	$('#starFilter').click(function() {
		$(this).toggleClass('filtering');
		
		// Zero means no limit on the number of labeled items to download
		if ( $(this).hasClass('filtering') ) {
			$('#reloadButton').attr('disabled', 'disabled');
			$('#updateHelper').css('visibility', 'hidden');
			$('#headerTools #feedsLoading').show();
			qnx.callExtensionMethod("greader.labeleditems", "starred", 0, "parseGoogleLabeledItems");	
		} else {
			$('#reloadButton').attr('disabled', '');
			loadFeeds();
		}
	}).bind('loggedOut', function() {
		$(this).removeClass('filtering');
	});

	// Mark unread button action
	$('#social_nav_horizontal ul li.unread').bind('click', function(event) {
		// pseudo-atomic operation
		if ( $(this).attr('disabled') == 'disabled' ) 
			return;	
		$(this).attr('disabled', 'disabled');

		var gId = $('#contentArea').data('story-data').gId;
		var gSource = "feed/" + $('#contentArea').data('story-data').source_url;
		
		$(this).toggleClass('unreadMarked');

		if ( $(this).hasClass('unreadMarked') )
			qnx.callExtensionMethod("greader.tag", gId, gSource, "kept-unread", 1, "gUnread");
		else
			qnx.callExtensionMethod("greader.tag", gId, gSource, "kept-unread", 0, "gUnread");	
	});
	
	// Mark as starred button action
	$('#social_nav_horizontal ul li.star').bind('click', function(event) {	
		// pseudo-atomic operation
		if ( $(this).attr('disabled') == 'disabled' ) 
			return;	
		$(this).attr('disabled', 'disabled');

		var gId = $('#contentArea').data('story-data').gId;
		var gSource = "feed/" + $('#contentArea').data('story-data').source_url;
		
		$(this).toggleClass('starMarked');
		
		if ( $(this).hasClass('starMarked') )
			qnx.callExtensionMethod("greader.tag", gId, gSource, "starred", 1, "gFav");
		else
			qnx.callExtensionMethod("greader.tag", gId, gSource, "starred", 0, "gFav");		
	});
		
	// To ease the process of filling the login form, we set the username field to the last inserted value.
	$('div#menuBar #loginFormContainer div.textBar input#usernameField').val(localStorage.gmail);
	$('div#menuBar #loginFormContainer div.textBar input#passwordField').val(localStorage.password);


	/*** Toggle UI when user logs in or logs out ***/

	$("div#menuBar #loginFormContainer div.textBar")
		.find("input#usernameField, input#passwordField")
		.addClass("toggleUI")
		.bind({
			loggedIn: function() { $(this).attr('disabled', 'disabled'); },
			loggedOut: function() { $(this).attr('disabled', ''); }
		});

	$('#starFilter')
		.addClass("toggleUI")
		.bind({
			loggedIn: function() { $(this).show(); },
			loggedOut: function() { $(this).hide(); }		
		});

	// Google login form submit button
	$('#loginFormContainer #loginFormFooterRight #googleFormSubmit')
		.addClass("toggleUI")
		.bind({
			loggedIn: function() { $(this).html("logout"); },
			loggedOut: function() { $(this).html("login"); },
			click: function(event) {
				if(googleReaderMode) {
					qnx.callExtensionMethod("greader.logout");
					googleReaderMode = false;
					$(".toggleUI").trigger("loggedOut");
					// Clear status message
					$('div#menuBar #loginFormContainer div#loginFormFooterLeft span').html('');
					$('div#menuBar #loginFormContainer img#googleLoading').hide();
					// Local storage modifications
					localStorage.googleReaderMode = false;
					feedList = JSON.parse(localStorage.feedListBackup);						
					localStorage.feedList = JSON.stringify(feedList);
					localStorage.removeItem(feedListBackup);
					localStorage.password = "";
					loadFeeds();
				} else {
					if ($(this).attr('disabled') != 'disabled') {
						// Temporarily disable login button
						$(this).attr('disabled', 'disabled');
						// Display loading message
						$('div#menuBar #loginFormContainer div#loginFormFooterLeft span').html('Authenticating');
						$('div#menuBar #loginFormContainer img#googleLoading').show();
						// Get login data	
						var email = $('div#menuBar #loginFormContainer div.textBar input#usernameField').val();
						var passwd = $('div#menuBar #loginFormContainer div.textBar input#passwordField').val();
						// Local storage modifications
						localStorage.gmail = email;
						localStorage.password = passwd;
						// Call Adobe AIR extension
						qnx.callExtensionMethod("greader.login", email, passwd, "gLogin");
					}
				}
			}
		});

}


// --------------------------------------------------------------------------------------- //
// 								THE GRID functions
// --------------------------------------------------------------------------------------- //




// Method that displays a cell's content and marks it as selected
function selectCell() {    
    // Sets contentArea to the currently selected cell's contents
   	setContentForId($(this));
    showContentArea();
}


// Method that sets the content area to the selected cell's content
function setContentForId(cell) {
	// Cancel operation if 'cell' is false
	if (cell.length == 0) return;
	
	// Obtain previous and next visible cells
    var previousCell = $(cell).prevAll('li:visible').eq(0);
    var nextCell = $(cell).nextAll('li:visible').eq(0);
    
    // Selected cell index (Based on data position)
    var dataIndex = $('ul#cellArea > li').index(cell);
    // Selected cell data
    var story = stories[dataIndex];
    
    // Append story meta-data to contentArea to be retrieved later by social navigation items
	$('#contentArea').data('story-data', { 
		title: story.title, 
		img_src: $(story.img).attr('src'), 
		link: story.link,
		gId: story.id,
		source_url: story.source_url,
		labels: story.labels,
		previous: previousCell, 
		next: nextCell 
	});
    
    // Used for displaying the number of articles available to switch to
    var visibleCells = $('ul#cellArea > li:visible');
	var selectedIndex = $(visibleCells).index(cell) + 1;
	document.getElementById("articleCount").innerHTML = selectedIndex + " of " + visibleCells.length;
	
	var timeAgo = storyFreshness(story.date);
	$('#contentArea').scrollTop(0).html("<h2>" + story.title + "</h2><span class='source'>"+ story.source + "</span><h3>" + timeAgo + "</h3><hr />" + story.content);
	cleanContentInContainer("#contentArea");
	
	// Mark as read and remove "kept-unread"
	if (googleReaderMode) {
		qnx.callExtensionMethod("greader.tag", story.id, "feed/" + story.source_url, "read", 1, "gRead");
		if (jQuery.inArray("kept-unread", story.labels) != -1)
			qnx.callExtensionMethod("greader.tag", story.id, "feed/" + story.source_url, "kept-unread", 0, "gUnread");
	}
	
	// Analytics
	$.getJSON(analytics_url + "read?u=" + encodeURI(story.link) + "&c=" + country_code + "&callback=?", function() {});
}

// Method used to bring the contentArea to view
function showContentArea() {
	// Show contentArea
	contentAreaVisible = true;
	document.getElementById("contentOverlay").className = "showContentOverlay";
	// Indicate screen has changed to READMORE
	screen = screenMachine.CONTENTAREA;
}


// Method used to bring the contentArea out of view
function hideContentArea() {
	// Indicate screen has changed to THEGRID
	screen = screenMachine.THEGRID;
	// Hide contentArea
	document.getElementById("contentOverlay").className = "hideContentOverlay";
	contentAreaVisible = false;
	// Clear content to avoid taking up space
	$('#contentArea').html("");
}




// --------------------------------------------------------------------------------------- //
// 								MYFEEDS functions
// --------------------------------------------------------------------------------------- //




// Method that loads current feeds from memory
function readFeedArray() {
    var feedItems = [];
    var pendingItems = [];
    var feedStatus;
    
    var feedListTitle = (googleReaderMode)? "<h2>Google Subscriptions:</h2>" : "<h2>My Feeds:</h2>";
    
    if(feedsToggled) {
		$('#feedList').html(feedListTitle);
		feedsToggled.appendTo('#feedList');
		feedsToggled = null;
	} else {
		for (var i = 0; i < feedList.length; i++) {
        	feedStatus = (feedList[i].status > 0) ? "validFeed" : "invalidFeed";
        	feedItems[i] = 
        	    "<li class='" + feedStatus + "'><div class='deleteBox'></div>" +
         	   "<div class='feedInfo'><h3>" + feedList[i].title + "</h3>" +
         	   "<em>" + feedList[i].url + "</em></div></li>";
		}
		
		$("#feedList").html(feedListTitle);
    
		// If there are no feeds in feedList
		if (feedList.length > 0) {
			$("#feedList").append(feedItems.join(''));
		} else {
			$("#feedList").append("<h3>You currently have no feeds stored.</h3>");
		}
		
		$('ul#feedList li').click(markForDeletion);

	}
    
    var myFeedsCount = $('ul#feedList li').size();
    var toBeRemoved = false;
    
    for (var i = 0; i < addQueue.length; i++) {
    	// If this element was already marked for deletion
    	toBeRemoved = (jQuery.inArray(i + myFeedsCount, indexesToBeRemoved) >= 0);    		
    	
        pendingItems[i] = 
            "<li class='toBeAdded " + (toBeRemoved?"markedForDeletion":"") + "'><div class='deleteBox'></div>" +
            "<div class='feedInfo'><h3>" + addQueue[i].title + "</h3>" +
            "<em>" + addQueue[i].url + "</em></div></li>";
		    
    }
    
    
    // If there are feeds pending to be added
    if (addQueue.length > 0) {
    	$("#feedList").append("<h2>To be Added:</h2>" + pendingItems.join(''));
    	$('ul#feedList li.toBeAdded').click(markForDeletion);
    	
    }
    
    
	
}

// Method that loads search results
function loadSearchResults(result) {
    var feeds = [];
    var entry;
    var boxType;
    var rowClass;
    if (!result.error) {
		if (result.query != mostRecentSearchQuery) return; // Avoids loading delayed results
        for (var i = 0; i < result.entries.length; i++) {
            entry = result.entries[i];
            
            boxType = "checkBox";
            $(feedList).each(function() {
            	if (this.url == entry.url) {
            		boxType = 'disabledBox';
            		return false;
            	}
            });
            
            rowClass = '';
            $(addQueue).each(function() { 
            	if (this.url == entry.url) { 
		            rowClass = " class='markedForAddition'";
            		return false; 
            	} 
            }); 
            
            feeds[i] = 
                "<li" + rowClass + "><div class='" + boxType + "'></div>" +
                "<div class='feedInfo'><h3>" + entry.title + "</h3>" +
                entry.contentSnippet + "<em>" + entry.url + "</em></div></li>";
        }
        
        $("#feedList").html("<h2>Search Results:</h2>" + feeds.join(''));
        if (!result.entries.length) 
        	$("#feedList").append("<h3>No results were found</h3>");
        
        $('ul#feedList li').bind('click', function() {
			markForAddition($(this));
        });
    } else {
        // TODO - Display search error?
    }
}


// Filters the visible cells depending on the query
function filter(query) {
	hideContentArea();
	if (query) {
        $("#page ul#cellArea li").filter(':Contains(' + query + ')').show().end().filter(':not(:Contains(' + query + '))').hide();
    } else { 
    	$("#page ul#cellArea li").show();
    }    
}


// Searches google api for the query and loads results
function search(query) {
	if(google === undefined) return;

	if(query != ''){
		// Save MYFEEDS temporarily and detach from screen
		if (!feedsToggled)
			feedsToggled = $('#feedList li').not('.toBeAdded').detach();
		
		mostRecentSearchQuery = query;
		// Replace h2 text in MYFEEDS to show 'searching' status
		$('#feedList h2:first').html("Searching...");
    	google.feeds.findFeeds(query, loadSearchResults);
   	} else { 
   		readFeedArray(); 
   	}
}


// Method that makes a text field editable
function editFeed(field) {
	var row = $(field).parent().parent();
	var index = $('ul#feedList li').index(row);
	field.value = field.text();
	field.addClass('textModified');
	field.html('<input type="text" value="'+ field.value +'">').find('input').bind('blur', function(event) {
		if($(this).val() != "") {
			field.value = $(this).val();
			// Add the modified feed to modifyQueue
			var feed = {
				title: row.find('h3').text(),
				url: row.find('input').val(),
				status: 0
			};
			if(index >= 0)
				modifyQueue.push([index, feed]);
		} 
		field.text(field.value);
	}).focus();	
}


// Method that places feeds to be deleted in a delete queue
function markForDeletion() {
	var row = $(this);
	$(row).toggleClass('markedForDeletion');
	if ($(row).hasClass('markedForDeletion')) {
		indexesToBeRemoved.push($('ul#feedList li').index(row));
	} else {
		var indexOfIndex = indexesToBeRemoved.indexOf($('ul#feedList li').index(row));
		indexesToBeRemoved.splice(indexOfIndex,1);
	}
}

// Method that places feeds to be added in an add queue
function markForAddition(row) {
	var feed = newFeedObject(row.find('h3').text(), row.find('em').text());
	
	$(row).toggleClass('markedForAddition');
	if ($(row).hasClass('markedForAddition')) {
		addQueue.push(feed);
	} else {
		var indexOfIndex = addQueue.indexOf(feed);
		addQueue.splice(indexOfIndex,1);
	}
}




// --------------------------------------------------------------------------------------- //
// 								EDIT MODE functions
// --------------------------------------------------------------------------------------- //




// Method that displays the feedList edit area and removes cells temporarily from the html
function showEditMode() {
	// Save the state of the searchBox
	searchBoxContent = $('#searchBox').val();
	$('#searchBox').val('');
	// Set appropriate text placeholder for searchBox
	$('#searchBox').attr('placeholder','Enter keywords to find more feeds...');
	// Changes reload icon for search icon
	$('#reloadButton').attr('src', 'images/search.png');
	// Hides helper image
	$('#sourcesHelper').css('visibility','hidden');
	// Hides star filter image
	$('#starFilter').css('visibility','hidden');
	// Append 'new feed' button
	$('#headerTools #newFeedButton').css('display','block');
	// Hide cellArea
	document.getElementById('cellArea').style.display = "none";
	// Show editBar
	$('#editBar').show();
	// Show feedList
	document.getElementById('feedList').style.display = "block";
	// Indicate screen has changed to MYFEEDS
	screen = screenMachine.MYFEEDS;
	// Toggle helper image
	$('#updateHelper').toggle();
}

function hideEditMode() {
	// Hide editBar
	$('#editBar').hide();
	// Hide feedList
	document.getElementById('feedList').style.display = "none";
	// Show cellArea
	document.getElementById('cellArea').style.display = "block";
	// Indicate screen has returned to THEGRID
	screen = screenMachine.THEGRID;
	// Clear feedsToggled variable to avoid displaying past states in the settings screen
	feedsToggled = null;
	// Restore the state of the searchBox
	$('#searchBox').val(searchBoxContent);
	$('#searchBox').attr('placeholder','Enter text to filter your news...');
	// Restores reload icon
	$('#reloadButton').attr('src', 'images/refresh.png');
	// Restores star filter image
	$('#starFilter').css('visibility','visible');	
	// Remove newFeedButton
	$('#headerTools #newFeedButton').css('display','none');
	// Toggle helper image
	$('#updateHelper').toggle();
	
	// Reset arrays
	indexesToBeRemoved = [];
	addQueue = [];
	modifyQueue = [];
}


// Method that saves settings after editing
function saveChanges() {
	var needRefresh = false;
	if (!(addQueue.length + modifyQueue.length + indexesToBeRemoved.length)) {
		discardChanges();
		return;
	} 
	if (addQueue.length > 0) {
		feedList = feedList.concat(addQueue);
		
		if (googleReaderMode)
			for (var i = 0; i < addQueue.length; i++)
				qnx.callExtensionMethod("greader.add", addQueue[i].url, "gAdd");
		
		needRefresh = true;
	}
	for (var i = 0; i < modifyQueue.length; i++) {
		if (!needRefresh) 
			needRefresh = true;
		feedList.splice(modifyQueue[i][0], 1, modifyQueue[i][1]);
	}
	for (var i = 0; i < indexesToBeRemoved.length; i++) {
		removeCellsForTitle((feedList[indexesToBeRemoved[i]]).title);
		removeStoriesForFeedUrl(feedList[indexesToBeRemoved[i]].url);
		
		if (googleReaderMode)
			qnx.callExtensionMethod("greader.del", feedList[indexesToBeRemoved[i]].url, "gDel");
		
		feedList.splice(indexesToBeRemoved[i], 1, 'foo'); // mark for removal
	}
	
	for (var i = 0; i < feedList.length; i++) {
		if (feedList[i] === 'foo') {
			feedList.splice(i, 1);
			i -= 1;
		}
	}
	
	// Save feedList to localStorage
	localStorage.feedList = JSON.stringify(feedList);
	
	if (needRefresh)
		loadFeeds();
	// Close edit box
	hideEditMode();
}


// Method that discards settings after editing
function discardChanges() {
	// Close edit box
	hideEditMode();
}


// Removes cells that correspond to a given title
function removeCellsForTitle(feedName) {
	$(document.getElementById('cellArea')).find('li span i').filter(":contains('" + feedName + "')").parent().parent().remove();
}



// Remove story entries that correspond to a given feed
function removeStoriesForFeedUrl(feedUrl) {
	for (var i = 0, removeCount = 0; i < stories.length; i++) {
		if (stories[i].source_url == feedUrl) {
			stories.splice(i, 1);
			if (++removeCount == ENTRIES_PER_FEED)
				break; // assume we're not finding more matches ahead
			else
				i -= 1;                        
		}
	}
}



// --------------------------------------------------------------------------------------- //
// 								Menu bar functions
// --------------------------------------------------------------------------------------- //



// Set handlers for bezel actions 
function setHandlers()
{
	if (typeof blackberry !== 'undefined') {
		blackberry.app.event.onSwipeDown(toggleMenuBar);
	} else {
		// Do nothing since I am not a BlackBerry device that support 'blackberry.app'
	}
}

function toggleMenuBar()
{
	if(menuVisible) {
		//document.getElementById("menuBar").className = "hideMenuBar";
		document.getElementById("menuBar").style.top = "-250px";
		menuVisible = false;
	} else {
		if(screen === screenMachine.CONTENTAREA) {
		
			// Show social_nav_horizontal and hide loginFormContainer
			document.getElementById('loginFormContainer').style.display = "none";
			document.getElementById('social_nav_horizontal').style.display = "block";
			
			if (googleReaderMode) {
			
				document.getElementById('googleReaderExtras').style.display = "block";
				// Toggle googleReaderExtras
				var labels = $('#contentArea').data('story-data').labels;
				$('#social_nav_horizontal ul li.star').toggleClass('starMarked', jQuery.inArray("starred", labels) != -1);
				$('#social_nav_horizontal ul li.unread').toggleClass('unreadMarked', jQuery.inArray("kept-unread", labels) != -1);

			} else {
				document.getElementById('googleReaderExtras').style.display = "none";
			}
		} else {
			// Show loginFormContainer and hide social_nav_horizontal
			document.getElementById('social_nav_horizontal').style.display = "none";
			document.getElementById('loginFormContainer').style.display = "block";
		}
		//document.getElementById("menuBar").className = "showMenuBar";
		document.getElementById("menuBar").style.top = "0px";
		menuVisible = true;
	}
}



// --------------------------------------------------------------------------------------- //
// 								Misc functions
// --------------------------------------------------------------------------------------- //




// Method that makes a text field editable
function editTitle(field) {
	field.value = field.text();
	field.addClass('textModified');
	field.html('<input type="text" value="'+ field.value +'">').find('input').bind('blur', function(event) {
		if($(this).val() != "") {
			field.value = $(this).val();
		} 
		field.text(field.value);
	}).focus();	
}


// Fixes layout issues due to windows size changes
function fixElementSizes() {
	var windowWidth = $(this).width();
	var newFrameHeight = $(this).height() - 50 - 4; // 50 px to compensate for readMoreBar height, 4px for bottom margin

	var newWidth = $('#searchBar').innerWidth() - 50; // 50 pixels compensating the inner padding
	$('#searchBox').css('width', newWidth);
	// Adjust readMore iframe height to the current window height
	$('#readMoreSection iframe').css('height', newFrameHeight);
	$('#readMoreSection iframe').css('width', windowWidth);
}
		
// Method that changes the font size of the contentArea
function changeFontSize() {
	var newSize;
	if ((!contentAreaFontSize) || (contentAreaFontSize == "undefined")) {
		// Default value
		contentAreaFontSize = "1em";
	}
	
	if (contentAreaFontSize == "0.8em") {
		// Small size -> change to normal
		newSize = "1em";
	} else if (contentAreaFontSize == "1em") {
		// Normal size -> change to large
		newSize = "1.5em";
	} else if (contentAreaFontSize == "1.5em") {
		// Large size -> change to small
		newSize = "0.8em";
	}
	
	// Save new font size to local storage
	localStorage.fontSize = newSize;
	contentAreaFontSize = newSize;
	// Set new font size to content area
	$('#contentArea').css('font-size', newSize);
}

// Method that displays the readMoreScreen and detaches the page temporarily from the html
function showReadMore(url) {
	hideContentArea();
	// Scroll windows to the top of the page
	window.scrollTo(0, 0);
	// Hide page
	document.getElementById('page').style.display = "none";
	// Show readMoreSection
	document.getElementById('readMoreSection').style.display = "block";
	// Change the iframe src
	$('#templates #readMoreFrame').clone().attr('src', url).appendTo('#readMoreSection');
	// Indicate screen has changed to READMORE
	screen = screenMachine.READMORE;
	// Ensure iframe height is properly set
	fixElementSizes();
}

function hideReadMore() {
	// Remove current iframe content from readMoreSection
	$('#readMoreSection #readMoreFrame').remove();
	// Hide readMoreSection
	document.getElementById('readMoreSection').style.display = "none";
	// Show page
	document.getElementById('page').style.display = "block";
	// Indicate screen has returned to THEGRID
	screen = screenMachine.THEGRID;
}

function facebookSetup() {
	// glimpse app_id on facebook
	var app_id = '201247833230734';
	var redirect_uri = 'http://glimpse.teiga.mx';

	// Facebook Link action
	$('#social_nav_horizontal ul li.facebook').bind( 'click', function(event) {
		var story_data = $('#contentArea').data('story-data');
		var storyImageSource = story_data.img_src;
		var link = story_data.link;
		
		// Analytics
		$.getJSON(analytics_url + "shared?u=" + encodeURI(link) + "&s=facebook&callback=?", function() {});
				
		// Avoid 'undefined' text to be sent to facebook as an image link
		if (!storyImageSource)
			storyImageSource = "";
		var post = 
			"https://www.facebook.com/dialog/feed?app_id=" + app_id +
			"&redirect_uri=" + redirect_uri +
			"&link=" + link + "&picture=" + storyImageSource + "&caption=" + story_data.title;
		
		// Invoke browser
		followLink(post);
	});
	
}

// Method to follow links in BlackBerry Browser
function followLink(address) {
	var encodedAddress = "";
	// URL Encode all instances of ':' in the address
	encodedAddress = address.replace(/:/g, "%3A");
	// Leave the first instance of ':' in its normal form
	encodedAddress = encodedAddress.replace(/%3A/, ":");
	// Escape all instances of '&' in the address
	encodedAddress = encodedAddress.replace(/&/g, "\&");
	
	if (typeof blackberry !== 'undefined') {
		try{
			// If I am a BlackBerry device, invoke native browser
			var args = new blackberry.invoke.BrowserArguments(encodedAddress);
			blackberry.invoke.invoke(blackberry.invoke.APP_BROWSER, args);
		} catch(e) {
 			alert("Sorry, there was a problem invoking the browser");
 		}
	} else {
		// If I am not a BlackBerry device, open link in current browser
		window.location = encodedAddress; 
	}
}

// Method to show the loading placeholder div
function showLoading() {
	$('#loadingPlaceholder').css('display','block');
}

// Method to set the loading text in placeholder div
function setLoading(text) {
	$('#loadingText').html(text);
}

// Method to hide the loading placeholder div
function hideLoading() {
	$('#loadingPlaceholder').css('display','none');
}

// HANDLE dialog answer
function dialogCallback(selectedButtonIndex) {
	// Invoke exit if "exit app" was selected
	if (selectedButtonIndex == 0) {
		try {
			blackberry.app.exit();
		} catch(e) {
			alert('Something went wrong. Please close app manually.');
		}		
	} else if (selectedButtonIndex == 1) {
		// If "close dialog" is selected, load feed list and continue
		// This will avoid having an empty feed list in manage my feeds
		if (localStorage.feedList)
			feedList = JSON.parse(localStorage.feedList);
		
		loadOfflineStories();
	}
}

// UPDATES country code
function countryCodeReceived(code) { country_code = code; }