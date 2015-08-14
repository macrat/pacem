var __position = null;
var __error_handlers = [];
var __on_updates = [];


function getPosition(callback){
	if(__position){
		callback(__position);
	}else{
		navigator.geolocation.getCurrentPosition(callback);
	}
}


function addGeopositionErrorHandler(handler){
	__error_handlers.push(handler);
}


function addLocationUpdatedHandler(handler){
	__on_updates.push(handler);
}


(function(){
	function positionSave(position){
		__position = position;
		for(var i in __on_updates){
			__on_updates[i](position);
		}
	}

	navigator.geolocation.getCurrentPosition(function(position){
		positionSave(position);
	});

	navigator.geolocation.watchPosition(positionSave, function(err){
		for(var i in __error_handlers){
			__error_handlers[i](err);
		}
	});
})();
