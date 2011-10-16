/**
 * The Paparazzi Algorithm 
 * -----------------------
 * @description An algorithm to find and learn the best location to retrieve images from a particular feed
 * @author Rodolfo Wilhelmy (rod@teiga.mx)
 * @copyright TEIGA (http://www.teiga.mx)
 * @updated 05-APR-11
 *
 **/

var votes = [], voters = [], itemId, IMAGE_METHOD_UNDEFINED = 0;

// FIND the best image extraction method for a new RSS feed
function paparazzi(item, feedUrl, feedId) {
	var pendingImages = [], pendingMethods = [];
	
	// Initializing bestMethod to anything less than the first extraction method
	var bestMethod = IMAGE_METHOD_UNDEFINED;
	var imageFound = null;
	// We need a temporary img with size attributes greater than 0 to avoid breaking upcoming image comparisons and calls to imageHasSizeAttributes
	var bestImage = buildImageElementWithAttributes("images/teigaLogo.png", 1, 1);
	
	// CRAWL for images using all known extraction methods
	for (currentMethod in extractionMethods) {
		imageFound = getImageUsingExtractionMethod(item, extractionMethods[currentMethod]);
		// Skip iteration if we couldn't extract images using this method
		if (!imageFound) continue;
		
		if (!imageHasSizeAttributes(imageFound)) {
			// Can't check size, add image found to PENDING
			pendingImages.push(imageFound);
			pendingMethods.push(extractionMethods[currentMethod]);
		} else if (imageCompare(imageFound, bestImage) === -1) {
			// Our current best shot: Image FOUND IS BETTER than current
			bestImage = imageFound;
			bestMethod = extractionMethods[currentMethod];
		}
	}
	
	// Check pending images
	if (pendingImages.length) {
		// LOAD pending images for current item in hidden DIV, just to get DOM size values
		$(pendingImages).each(function() {
			$(this).attr('alt', feedId + '-' + itemId);
			$('#hiddenImages').append(this);
		});
		
		// We will have to WAIT for the pending images to LOAD, so add a handler to RETRIEVE SIZE attributes when available
		$('#hiddenImages img[alt=' + (feedId + '-' + itemId) + ']').bind('load error', function() {
			// GET index of current loaded image
			var index = $('#hiddenImages img[alt=' + $(this).attr('alt') + ']').index(this);		
			
			// LOOK for better images
			// We invoke buildImageElement because there will be some loaded pending images lacking size attributes,
			// therefore we build image elements w/attributes using DOM computed width and height.
			if (imageCompare(buildImageElementWithAttributes(this.src, this.width, this.height), bestImage) == -1) {
				// Image loaded is BETTER than current
				bestImage = this;
				// RETRIEVE the extraction method used for $(this) item image
				bestMethod = pendingMethods.splice(index,1);
			} else {
				pendingMethods.splice(index,1);
			}
			
			// REMOVE test image
			$(this).remove();
							
			// We're done checking all pending images for this item, now VOTE
			if (!pendingMethods.length)
				$('#hiddenImages').triggerHandler("vote", [feedUrl, feedId, bestImage, bestMethod]);				
		});
	} else {
		// We found something good for this item, so now VOTE
		$('#hiddenImages').triggerHandler("vote", [feedUrl, feedId, bestImage, bestMethod]);
	}
	
	itemId++;
	
	// Return our current best shot
	return (bestImage.attr('src') == "images/teigaLogo.png")? null : bestImage;
}

// Feed's item will vote for its best image extraction method
function voteForExtractionMethod(event, feedUrl, feedId, bestImage, bestMethod) {
	// VOTE for best method found
	votes[feedId][bestMethod]++;

	// Go back if we still have PENDING VOTERS
	if (--voters[feedId]) return;

	// After analyzing all items, find elected extraction method for this feed
	var elected = indexOfMaxValue(votes[feedId]);
	// If selected best method is undefined (value of 0) choose a second winner
	if (elected == IMAGE_METHOD_UNDEFINED) {
		// REMOVE votes from first candidate (IMAGE_METHOD_UNDEFINED) to FIND a new winner
		votes[feedId].shift();
		elected = indexOfMaxValue(votes[feedId]) + 1;
		// We need to ADJUST the index movement caused by shift() method
		// e.g. [8,2,0,0,0,0,0] -> [2,0,0,0,0,0]
		// elected will return 0 in this case but the real elected extractionMethod is 1
	}
	
	// SAVE elected extraction method for new feed
	feedList[feedId].imageLocation = elected;
	// Save feedList to localStorage
	localStorage.feedList = JSON.stringify(feedList);
}

function indexOfMaxValue(intArray) {
	// Setting 0 as default answer means IMAGE_METHOD_UNDEFINED will be returned on strange cases
	var maxIndex = 0, maxValue = 0;
	
	for (var i = 0; i < intArray.length; i++) {
		if (intArray[i]	> maxValue) {
			maxValue = intArray[i];
			maxIndex = i;
		}
	}
	
	return maxIndex;
}

// Validates a HtmlImageElement
function isImageOk(img) {
	var MIN_SIZE = 100;
	// Doesn't break if img is null or attrs are undefined
	var w = parseInt($(img).attr('width'));
	var h = parseInt($(img).attr('height'));
	return (w >= MIN_SIZE || h >= MIN_SIZE); 
}

function zeroOutArrayWithSize(arr, len) {
	for (var i = 0; i < len; i++) arr.push(0);
}