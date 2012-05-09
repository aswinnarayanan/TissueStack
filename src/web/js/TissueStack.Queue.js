TissueStack.Queue = function (canvas) {
	this.canvas = canvas;
};

TissueStack.Queue.prototype = {
	canvas : null,
	queue_handle : null,
	drawingIntervalInMillis : 100,
	requests : [],
	presentlyQueuedZoomLevelAndSlice: null,
	lowResolutionPreviewDrawn : false,
	latestDrawRequestTimestamp : 0,
	setDrawingInterval : function(value) {
		if (typeof(value) !== 'number' || value < 0) {
			throw new Error("Interval has to be greater or equal to 0");
		}
		this.stopQueue();
		this.drawingIntervalInMillis = value;
		this.startQueue();
	},startQueue : function() {
		if (this.queue_handle) { // already active
			return;
		}
		
		this.queue_handle = setInterval(function(_this) {
			// sanity check, if we still have some requests queued
			if (_this.requests.length == 0) {
				_this.stopQueue();
				return;
			};
			
			// work with deep copy, is safer and also leave last request in there instead of popping it
			var latestRequest = $.extend(true, {}, _this.requests[_this.requests.length-1]);
			if (!latestRequest) {
				_this.stopQueue();
				return;
			}
			
			// double check if we are obsolete already
			if (_this.presentlyQueuedZoomLevelAndSlice !== ('' + latestRequest.zoom_level + '_' + latestRequest.slice)) {
				_this.clearRequestQueue();
				_this.stopQueue();
				return;
			}

			_this.latestDrawRequestTimestamp = latestRequest.timestamp;
			_this.clearRequestQueue();
			
			_this.prepareDrawRequest(latestRequest);
			_this.drawLowResolutionPreview(_this.latestDrawRequestTimestamp);
			_this.drawRequestAfterLowResolutionPreview(latestRequest);
		}, this.drawingIntervalInMillis , this);
	},
	stopQueue : function() {
		if (!this.queue_handle) {
			return;
		}
		clearInterval(this.queue_handle);
		this.queue_handle = null;
	},
	addToQueue : function(draw_request) {
		// we have no existing queue for the zoom level and slice =>
		// this means: A) we have to create it AND B) we have to empty the queue to get rid of old requests
		if (this.presentlyQueuedZoomLevelAndSlice !== ('' + draw_request.zoom_level + '_' + draw_request.slice)) {
			this.presentlyQueuedZoomLevelAndSlice = '' + draw_request.zoom_level + '_' + draw_request.slice;
			this.requests = [];
		}
		
		// clicks and zooms are processed instantly
		if (draw_request.action == "CLICK" || draw_request.action == "ZOOM") {
			var deepCopyOfRequest = $.extend(true, {}, draw_request);
			this.clearRequestQueue();
			this.latestDrawRequestTimestamp = deepCopyOfRequest.timestamp;
			
			// work with a deep copy
			this.prepareDrawRequest(deepCopyOfRequest);
			
			this.drawLowResolutionPreview(deepCopyOfRequest.timestamp);
			this.drawRequestAfterLowResolutionPreview(deepCopyOfRequest);

			return;
		}
		
		// queue pans
		this.requests.push(draw_request);
		
		// process through queue
		this.startQueue();
	},
	drawRequestAfterLowResolutionPreview : function(draw_request, timestamp) {
		var lowResBackdrop = setInterval(function(_this, draw_request, timestamp) {
			if (_this.lowResolutionPreviewDrawn) {
				if (draw_request) {
					_this.drawRequest(draw_request);
				} else {
					_this.canvas.drawMe(timestamp);
				}
				clearInterval(lowResBackdrop);
			}
		}, 50, this, draw_request, timestamp);		
	},
	clearRequestQueue : function() {
		this.requests = [];
	}, drawLowResolutionPreview : function(timestamp) {
		// this is to prevent preview fetching for the cases when the user is navigating in a view that exceeds the data extent
		// so that they can set the crosshair outside of the extent
		var slice = this.canvas.getDataExtent().slice;
		if (slice < 0 || slice > this.canvas.getDataExtent().max_slices) {
			this.lowResolutionPreviewDrawn = true;
			return;
		}

		this.lowResolutionPreviewDrawn = false;

		var ctx = this.canvas.getCanvasContext();
		
		// nothing to do if we are totally outside
		if (this.canvas.upper_left_x < 0 && (this.canvas.upper_left_x + this.canvas.getDataExtent().x) <=0
				|| this.canvas.upper_left_x > 0 && this.canvas.upper_left_x > this.canvas.dim_x
				|| this.canvas.upper_left_y <=0 || (this.canvas.upper_left_y - this.canvas.getDataExtent().y) >= this.canvas.dim_y) {
			this.lowResolutionPreviewDrawn = true;
			return;
		} 
		
		var canvasX = 0;
		var imageOffsetX = 0;
		var width = this.canvas.getDataExtent().x;
		if (this.canvas.upper_left_x < 0) {
			width += this.canvas.upper_left_x;
			imageOffsetX = this.canvas.getDataExtent().x - width;
		} else {
			canvasX = this.canvas.upper_left_x;
		}
		
		if (canvasX + width > this.canvas.dim_x) {
			width = this.canvas.dim_x - canvasX;
		}

		var canvasY = 0;
		var imageOffsetY = 0;
		var height = this.canvas.getDataExtent().y;
		if (this.canvas.upper_left_y <= this.canvas.dim_y) {
			canvasY = this.canvas.dim_y - this.canvas.upper_left_y;
		} else {
			imageOffsetY = this.canvas.upper_left_y - this.canvas.dim_y;
			height = this.canvas.getDataExtent().y - imageOffsetY;
		}
		
		if (height > this.canvas.dim_y) {
			height = this.canvas.dim_y;
		}
		
		var imageTile = new Image();
		imageTile.src = 
			TissueStack.tile_directory + this.canvas.getDataExtent().data_id + "/" + this.canvas.getDataExtent().zoom_level + "/" 
			+ this.canvas.getDataExtent().plane
			+ "/" + slice + ".low.res." + this.canvas.image_format;

		(function(_this, imageOffsetX, imageOffsetY, canvasX, canvasY, width, height) {
			imageTile.onload = function() {
				if (timestamp < _this.latestDrawRequestTimestamp) {
					_this.lowResolutionPreviewDrawn = true;
					return;
				}
			
				if (this.width < width) {
					width = this.width;
				}

				if (this.height < height) {
					height = this.height;
				}

				ctx.drawImage(this, imageOffsetX, imageOffsetY, width, height, canvasX, canvasY, width, height);
				_this.lowResolutionPreviewDrawn = true;
				
				_this.canvas.applyColorMapToCanvasContent();
			};
		})(this, imageOffsetX, imageOffsetY, canvasX, canvasY, width, height);
	}, prepareDrawRequest : function(draw_request) {
		var thisHerePlane = this.canvas.getDataExtent().plane;

		if (draw_request.action == 'ZOOM') { // zoom request
			this.canvas.changeToZoomLevel(draw_request.zoom_level);
			return;
		}

		if (draw_request.plane === thisHerePlane) { 
			// nothing to do for our own canvas
			return;
		}

		// we have to process the coordinate cross moves first
		if (draw_request.action == 'POINT') {
			this.canvas.drawCoordinateCross(this.canvas.getCenter());
		}

		if (thisHerePlane === 'x' && draw_request.plane === 'z' && draw_request.action == 'CLICK') {
			this.canvas.drawCoordinateCross(
					{x: draw_request.canvasDims.y - (draw_request.crossCoords.y + ((draw_request.canvasDims.y - draw_request.crossCoords.y)- this.canvas.cross_x)),
					 y:  this.canvas.cross_y});
		} else if (thisHerePlane === 'y' && draw_request.plane === 'z' && draw_request.action == 'CLICK') {
			this.canvas.drawCoordinateCross(
					{x: draw_request.crossCoords.x + (this.canvas.cross_x - draw_request.crossCoords.x),
					 y: this.canvas.cross_y});
		} else if (thisHerePlane === 'x' && draw_request.plane === 'y' && draw_request.action == 'CLICK') {
			this.canvas.drawCoordinateCross(
					{x: this.canvas.cross_x,
					 y: (draw_request.canvasDims.y - draw_request.crossCoords.y) + ((this.canvas.dim_y - this.canvas.cross_y) - (draw_request.canvasDims.y - draw_request.crossCoords.y))});
		} else if (thisHerePlane === 'z' && draw_request.plane === 'y' && draw_request.action == 'CLICK') {
			this.canvas.drawCoordinateCross(
					{x: draw_request.crossCoords.x + (this.canvas.cross_x - draw_request.crossCoords.x),
					 y:  this.canvas.cross_y});
		} else if (thisHerePlane === 'y' && draw_request.plane === 'x' && draw_request.action == 'CLICK') {
			this.canvas.drawCoordinateCross(
					{x:  this.canvas.cross_x,
						y: (draw_request.canvasDims.y - draw_request.crossCoords.y) + ((this.canvas.dim_y - this.canvas.cross_y) - (draw_request.canvasDims.y - draw_request.crossCoords.y))});
		} else if (thisHerePlane === 'z' && draw_request.plane === 'x' && draw_request.action == 'CLICK') {
			this.canvas.drawCoordinateCross(
					{x: this.canvas.cross_x,
					 y: this.canvas.dim_y - (draw_request.crossCoords.x + ((this.canvas.dim_y - this.canvas.cross_y) - draw_request.crossCoords.x))});
		}
		
		var originalZoomLevelDims = this.canvas.getDataExtent().getZoomLevelDimensions(draw_request.zoom_level);
		// we have to remember that beforehand before we manipulate the coords to fit the zoom level
		var crossXOutsideOfExtentX = (draw_request.coords.x < 0) ? -1 : 0;
		if (draw_request.coords.x > (draw_request.max_coords_of_event_triggering_plane.max_x - 1)) {
			crossXOutsideOfExtentX = 1;
		}
		var crossYOutsideOfExtentY = (draw_request.coords.y < 0) ? -1 : 0;
		if (draw_request.coords.y > (draw_request.max_coords_of_event_triggering_plane.max_y - 1)) {
			crossYOutsideOfExtentY = 1;
		}
		
		if (draw_request.zoom_level != this.canvas.getDataExtent().zoom_level) {
			if (draw_request.coords.x < 0) {
				draw_request.coords.x = Math.abs(draw_request.coords.x);
				draw_request.upperLeftCorner.x = draw_request.crossCoords.x + draw_request.coords.x * (this.canvas.getDataExtent().x / originalZoomLevelDims.x);				
			} else if (draw_request.coords.x > (draw_request.max_coords_of_event_triggering_plane.max_x - 1)) {
				draw_request.coords.x = draw_request.coords.x - (draw_request.max_coords_of_event_triggering_plane.max_x - 1);
				draw_request.upperLeftCorner.x = draw_request.crossCoords.x + draw_request.coords.x * (this.canvas.getDataExtent().x / originalZoomLevelDims.x);
			} else {
				draw_request.upperLeftCorner.x = draw_request.crossCoords.x - draw_request.coords.x * (this.canvas.getDataExtent().x / originalZoomLevelDims.x);				
			}

			if (draw_request.coords.y < 0) {
				draw_request.coords.y = Math.abs(draw_request.coords.y);
				draw_request.upperLeftCorner.y = (draw_request.canvasDims.y - draw_request.crossCoords.y) - draw_request.coords.y * (this.canvas.getDataExtent().y / originalZoomLevelDims.y);				
			} else if (draw_request.coords.y > (draw_request.max_coords_of_event_triggering_plane.max_y - 1)) {
				draw_request.upperLeftCorner.y = (draw_request.canvasDims.y - draw_request.crossCoords.y) + draw_request.coords.y * (this.canvas.getDataExtent().y / originalZoomLevelDims.y);
			} else {
				draw_request.upperLeftCorner.y = (draw_request.canvasDims.y - draw_request.crossCoords.y) + draw_request.coords.y * (this.canvas.getDataExtent().y / originalZoomLevelDims.y);				
			}

			draw_request.upperLeftCorner.x = (draw_request.zoom_level == 1) ? Math.floor(draw_request.upperLeftCorner.x) : Math.ceil(draw_request.upperLeftCorner.x);
			draw_request.upperLeftCorner.y = (draw_request.zoom_level == 1) ? Math.floor(draw_request.upperLeftCorner.y) : Math.ceil(draw_request.upperLeftCorner.y);

			draw_request.coords.x = (draw_request.zoom_level == 1) ?
					Math.floor(draw_request.coords.x * (this.canvas.getDataExtent().x / originalZoomLevelDims.x)) :
					Math.ceil(draw_request.coords.x * (this.canvas.getDataExtent().x / originalZoomLevelDims.x));
			draw_request.coords.y = (draw_request.zoom_level == 1) ?
					Math.floor(draw_request.coords.y * (this.canvas.getDataExtent().y / originalZoomLevelDims.y)) :
					Math.ceil(draw_request.coords.y * (this.canvas.getDataExtent().y / originalZoomLevelDims.y));

			draw_request.max_coords_of_event_triggering_plane.max_x = (draw_request.zoom_level == 1) ?
					Math.floor(draw_request.max_coords_of_event_triggering_plane.max_x * (this.canvas.getDataExtent().x / originalZoomLevelDims.x)) :
					Math.ceil(draw_request.max_coords_of_event_triggering_plane.max_x * (this.canvas.getDataExtent().x / originalZoomLevelDims.x));
			draw_request.max_coords_of_event_triggering_plane.max_y = (draw_request.zoom_level == 1) ?
					Math.floor(draw_request.max_coords_of_event_triggering_plane.max_y * (this.canvas.getDataExtent().y / originalZoomLevelDims.y)) :
					Math.ceil(draw_request.max_coords_of_event_triggering_plane.max_y * (this.canvas.getDataExtent().y / originalZoomLevelDims.y));
		} 
		
		// these are the moves caused by other canvases
		if (thisHerePlane === 'x' && draw_request.plane === 'z') {
			this.canvas.getDataExtent().setSliceWithRespectToZoomLevel(
					(crossXOutsideOfExtentX < 0) ? -99 : ((crossXOutsideOfExtentX > 0) ? (draw_request.max_coords_of_event_triggering_plane.max_x + 99) : draw_request.coords.x));
			this.canvas.setUpperLeftCorner(
					(draw_request.upperLeftCorner.y - (draw_request.max_coords_of_event_triggering_plane.max_y - 1))
					+ (this.canvas.cross_x - (draw_request.canvasDims.y - draw_request.crossCoords.y)),
					this.canvas.upper_left_y);
		} else if (thisHerePlane === 'y' && draw_request.plane === 'z') {
			this.canvas.getDataExtent().setSliceWithRespectToZoomLevel(
					(crossYOutsideOfExtentY < 0) ?
							-99 :
							((crossYOutsideOfExtentY > 0) ? (draw_request.max_coords_of_event_triggering_plane.max_y + 99) :
								((draw_request.max_coords_of_event_triggering_plane.max_y - 1) - draw_request.coords.y)));
			this.canvas.setUpperLeftCorner(
					draw_request.upperLeftCorner.x + (this.canvas.cross_x - draw_request.crossCoords.x),
					this.canvas.upper_left_y);
		} else if (thisHerePlane === 'x' && draw_request.plane === 'y') {
			this.canvas.getDataExtent().setSliceWithRespectToZoomLevel(
					(crossXOutsideOfExtentX < 0) ? -99 : ((crossXOutsideOfExtentX > 0) ? (draw_request.max_coords_of_event_triggering_plane.max_x + 99) : draw_request.coords.x));
			this.canvas.setUpperLeftCorner(
					this.canvas.upper_left_x,
					draw_request.upperLeftCorner.y + ((this.canvas.dim_y - this.canvas.cross_y) - (draw_request.canvasDims.y - draw_request.crossCoords.y)));
		} else if (thisHerePlane === 'z' && draw_request.plane === 'y') {
			this.canvas.getDataExtent().setSliceWithRespectToZoomLevel(
					(crossYOutsideOfExtentY < 0) ?
							-99 :
							((crossYOutsideOfExtentY > 0) ? (draw_request.max_coords_of_event_triggering_plane.max_y + 99) :
								((draw_request.max_coords_of_event_triggering_plane.max_y - 1) - draw_request.coords.y)));
			this.canvas.setUpperLeftCorner(
					draw_request.upperLeftCorner.x + (this.canvas.cross_x - draw_request.crossCoords.x),
					this.canvas.upper_left_y);
		} else if (thisHerePlane === 'y' && draw_request.plane === 'x') {
			this.canvas.getDataExtent().setSliceWithRespectToZoomLevel(
					(crossXOutsideOfExtentX < 0) ? -99 : ((crossXOutsideOfExtentX > 0) ? (draw_request.max_coords_of_event_triggering_plane.max_x + 99) : draw_request.coords.x));
			this.canvas.setUpperLeftCorner(
					this.canvas.upper_left_x ,
					draw_request.upperLeftCorner.y + ((this.canvas.dim_y - this.canvas.cross_y) - (draw_request.canvasDims.y - draw_request.crossCoords.y)));
		} else if (thisHerePlane === 'z' && draw_request.plane === 'x') {
			this.canvas.getDataExtent().setSliceWithRespectToZoomLevel(((draw_request.max_coords_of_event_triggering_plane.max_y - 1) - draw_request.coords.y));
			this.canvas.setUpperLeftCorner(
					this.canvas.upper_left_x ,
					((draw_request.max_coords_of_event_triggering_plane.max_x - 1) + draw_request.upperLeftCorner.x + ((this.canvas.dim_y - this.canvas.cross_y) - draw_request.crossCoords.x)));
		}
	}, drawRequest : function(draw_request) {
		if (draw_request.action == 'ZOOM') {
			this.canvas.eraseCanvasContent();
		}
		
		// redraw 
		this.canvas.drawMe(draw_request.timestamp);

		// tidy up where we left debris
		if ((this.canvas.upper_left_x + this.canvas.getDataExtent().x) < 0
				|| (this.canvas.upper_left_x + this.canvas.getDataExtent().x) > this.canvas.dim_x
				|| this.canvas.upper_left_y < 0
				|| (this.canvas.upper_left_y - this.canvas.getDataExtent().y) > this.canvas.dim_y
				|| this.canvas.getDataExtent().slice < 0 || this.canvas.getDataExtent().slice > this.canvas.getDataExtent().max_slices
				|| (draw_request && draw_request.coords && draw_request.coords.x < 0) || (draw_request && draw_request.coords && draw_request.coords.y < 0)) {
			this.canvas.eraseCanvasContent(); // in these cases we erase the entire content
			return;
		}
		
		// we do a more efficient erase
		if (this.canvas.upper_left_x > 0) { // in front of us
			this.canvas.eraseCanvasPortion(0, 0, this.canvas.upper_left_x, this.canvas.dim_y);
		}
		if (this.canvas.upper_left_x <= 0 || (this.canvas.upper_left_x >= 0 && (this.canvas.upper_left_x + this.canvas.getDataExtent().x) < this.canvas.dim_x)){ // behind us
			this.canvas.eraseCanvasPortion(
					this.canvas.upper_left_x + this.canvas.getDataExtent().x, 0,
					this.canvas.dim_x - (this.canvas.upper_left_x + this.canvas.getDataExtent().x), this.canvas.dim_y);
		}
		
		if (this.canvas.upper_left_y < 0 || (this.canvas.upper_left_y < this.canvas.dim_y && this.canvas.upper_left_y >= 0)) { // in front of us
			this.canvas.eraseCanvasPortion(0, 0, this.canvas.dim_x, (this.canvas.upper_left_y <= 0) ? this.canvas.dim_y : (this.canvas.dim_y - this.canvas.upper_left_y));
		}
		if ((this.canvas.upper_left_y - this.canvas.getDataExtent().y) >= this.canvas.dim_y || (this.canvas.upper_left_y - this.canvas.getDataExtent().y) > 0) { // behind us
			this.canvas.eraseCanvasPortion(
				0, (this.canvas.upper_left_y >= this.canvas.dim_y && this.canvas.upper_left_y - this.canvas.getDataExtent().y >= this.canvas.dim_y) ? 0 : (this.canvas.dim_y - (this.canvas.upper_left_y - this.canvas.getDataExtent().y)),
				this.canvas.dim_x, 
				(this.canvas.upper_left_y >= this.canvas.dim_y && this.canvas.upper_left_y - this.canvas.getDataExtent().y >= this.canvas.dim_y) ?
						this.canvas.dim_y : (this.canvas.dim_y - (this.canvas.upper_left_y - this.canvas.getDataExtent().y)));
		}
	}
};
