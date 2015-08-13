var scene, camera, renderer, controls;
var beacon_list = {};
var beacon_models = [];
var mybeacon_list = {};
var current_beacon = null;

function changeMessage(message){
	var dest = $("#message");
	if(message == ""){
		$("main").css("display", "block");
		dest
			.fadeOut("slow")
			.html("")
	}else{
		if(dest.css("display") == "none"){
			dest
				.html(message)
				.fadeIn("slow", function(){
					$("main").css("display", "none");
				})
		}else{
			dest.fadeOut("fast", function(){
				dest
					.html(message)
					.fadeIn("fast")
			});
		}
	}
}

function currentMessage(){
	return $("#message").html();
}

function showNotify(message){
	$("#notify").append("<div>" + message + "</div>");

	var added = $("#notify div:last")
		.css("display", "none")
		.fadeIn("slow", function(){
			setTimeout(function(){
				added.fadeOut("slow", function(){
					added.remove();
				});
			}, 3000);
		})
}

var __confirm_callback = null;
function confirm(message, callback){
	$("#confirm_message").html(message);
	__confirm_callback = callback;
	if($("#confirm").css("display") == "none"){
		$("#confirm")
			.css({
				display: "flex",
				opacity: 0
			})
			.animate({ opacity: 1 }, { duration: 500 })
	}
}
function confirm_callback(choice){
	$("#confirm")
		.stop()
		.animate({ opacity: 0 }, {
			duration: 500,
			complete: function(){
				$("#confirm").css("display", "none");
			}
		})

	__confirm_callback(choice);
}

function cameraInit(){
	navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || window.navigator.mozGetUserMedia;

	function openFailed(message, detail){
		confirm(message + "<br>continue without camera?", function(choice){
			if(choice){
				if($("#loading").length == 0){
					changeMessage("");
				}
			}else{
				changeMessage(message + (detail?"<br>" + detail:""));
			}
		});
	}

	if(!navigator.getUserMedia){
		openFailed("this browser doesn't support user stream API");
		return;
	}

	MediaStreamTrack.getSources(function(data){
		for(var i in data){
			if(data[i].kind == "video" && data[i].facing == "environment"){
				navigator.getUserMedia(
					{ audio: false, video: {
						optional: [{ sourceId: data[i].id }]
					} },
					function(stream){
						document.querySelector("video").src = window.URL.createObjectURL(stream);
					},
					function(e){
						if(e.name == "PermissionDeniedError"){
							openFailed("camera access blocked", "please check browser settings");
						}else{
							openFailed("this device hasn't out camera");
						}
					}
				);
				return;
			}
		}
		openFailed("this device hasn't out camera");
	});
}

function positionChange(latitude, longitude, altitude){
	camera.position.x = latitude * 1519.85;
	camera.position.z = longitude * 1519.85;
	camera.position.y = 1;
}

function updatePosition(){
	navigator.geolocation.getCurrentPosition(function(e){
		positionChange(e.coords.latitude, e.coords.longitude, e.coords.altitude||0);

		$("#nearbeacons li, #mybeacons li").toArray().forEach(function(x){
			if($(x).parent().parent().attr("id") == "mybeacons"){
				var pos = mybeacon_list[x.dataset.id].place;
			}else{
				var pos = beacon_list[x.dataset.id].place;
			}
			var distance = Math.sqrt(Math.pow((pos[0]-e.coords.latitude), 2) + Math.pow((pos[1]-e.coords.longitude), 2)) * 1519.85;

			$(".distance", x).text(Math.round(distance) + "m");
			$(x).data("distance", distance)
		});

		$("#nearbeacons ul").html($("#nearbeacons li").toArray().sort(function(a,b){ return $(a).data("distance") - $(b).data("distance"); }));

		$("#mybeacons ul").html($("#mybeacons li").toArray().sort(function(a,b){ return $(a).data("distance") - $(b).data("distance"); }));

		$("#nearbeacons li, #mybeacons li").click(function(){
			var oldid = $(".selected_beacon").data("id");
			$(".selected_beacon").removeClass("selected_beacon");

			if(oldid == $(this).data("id")){
				current_beacon = null;
			}else{
				$(this)
						.attr("style", "")
						.addClass("selected_beacon")
				if($(this).parent().parent().attr("id") == "mybeacons"){
					current_beacon = mybeacon_list[$(this).data("id")];
				}else{
					current_beacon = beacon_list[$(this).data("id")];
				}
			}

			rewriteBeacons();
		});

		function down(){
			if($(".holded_beacon").length == 0){
				$(this)
					.addClass("holded_beacon")
					.css("color", "black")
					.data("holdstart", (new Date()))
			}
		}
		function up(){
			$(".holded_beacon").removeClass("holded_beacon");
			$("#mybeacons li").css({
				backgroundColor: "",
				color: ""
			});
		}
		$("#mybeacons li")
			.bind("touchstart", down)
			.mousedown(down)
			.bind("touchend", up)
			.mouseup(up)
	});
}

function rewriteBeacons(){
	var geo = new THREE.OctahedronGeometry(1);
	var frame = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
	var fill = new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: 0.3 });

	function putBeacon(beacon){
		var place = beacon.place;

		var mesh = new THREE.Mesh(geo, frame);
		mesh.position.x = place[0] * 1519.85;
		mesh.position.z = place[1] * 1519.85;
		mesh.position.y = 0;
		scene.add(mesh);
		beacon_models.push(mesh);

		var mesh = new THREE.Mesh(geo, fill);
		mesh.position.x = place[0] * 1519.85;
		mesh.position.z = place[1] * 1519.85;
		mesh.position.y = 0;
		scene.add(mesh);
		beacon_models.push(mesh);
	}

	beacon_models.forEach(function(model){
		scene.remove(model);
	});
	beacon_models = [];

	if(current_beacon){
		putBeacon(current_beacon);
	}else{
		for(var x in beacon_list){
			putBeacon(beacon_list[x]);
		}
	}

	renderer.render(scene, camera);
}

function updateBeacons(nearbeacons, mybeacons){
	beacon_models.forEach(function(model){
		scene.remove(model);
	});

	function zfill(x){
		return ("0" + x).slice(-2);
	}
	function makeBeaconListItem(beacon){
		return "<li data-id='" + beacon.id + "'><div><div class='owner'>" + beacon.owner + "</div><div class='created'>" + zfill(beacon.date.getMonth()) + "/" + zfill(beacon.date.getDate()) + " " + zfill(beacon.date.getHours()) + ":" + zfill(beacon.date.getMinutes()) + "</div></div><div class='distance'></div></li>";
	}

	beacon_list = {};
	mybeacon_list = {};

	$("#nearbeacons ul, #mybeacons ul").html("");

	nearbeacons.forEach(function(beacon){
		beacon_list[beacon.id] = beacon;
		$("#nearbeacons ul").append(makeBeaconListItem(beacon));
	});

	mybeacons.forEach(function(beacon){
		mybeacon_list[beacon.id] = beacon;
		$("#mybeacons ul").append(makeBeaconListItem(beacon));
	});

	rewriteBeacons();
	updatePosition();
}

function threeInit(){
	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
	controls = new THREE.DeviceOrientationControls(camera);

	renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
	renderer.setClearColor(0x000000, 0);
	renderer.setSize(window.innerWidth, window.innerHeight);

	$("main").append(renderer.domElement);

	(function animation(){
		window.requestAnimationFrame(animation);

		for(var i in beacon_models){
			beacon_models[i].rotation.y += 0.01;
		}

		controls.update();
		renderer.render(scene, camera);
	})();

	setInterval(updatePosition, 1000);

	window.addEventListener('resize', function(){
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();

			renderer.setSize(window.innerWidth, window.innerHeight);

			$("#menucontent").css("height", $("#sidemenu").innerHeight() - Number($("#sidemenu").css("padding").slice(0, -2))*2 - $("#menuheader").outerHeight());
		});
}

function guiInit(){
	var beaconmenu_height = $("#beaconmenu").outerHeight();

	$("#beaconmenu").css({
			bottom:  $("#beaconmenu").css("bottom") + beaconmenu_height,
			height: 0,
			opacity: 0
		});

	$("#menucontent").css("height", $("#sidemenu").innerHeight() - Number($("#sidemenu").css("padding").slice(0, -2))*2 - $("#menuheader").outerHeight());

	$("main").css("display", "none");

	$("#putbeacon").click(function(){
		$("#beaconmenu").animate({
			height: beaconmenu_height,
			opacity: 1
		});
		$("#putbeacon").fadeOut("slow");
		$("#putcancel").fadeIn("slow");
	});
	$("#putcancel, #sidemenu, #openmenu, #notify").click(function(){
		$("#beaconmenu").animate({
			height: 0,
			opacity: 0
		});
		$("#putbeacon").fadeIn("slow");
		$("#putcancel").fadeOut("slow");
	});
	$("#beaconmenu div").click(function(){
		putBeacon($(this).data("type"), function(){
			showNotify("put beacon here");
		});
		$("#beaconmenu").animate({
			height: 0,
			opacity: 0
		});
		$("#putbeacon").fadeIn("slow");
		$("#putcancel").fadeOut("slow");
	});

	$("#openmenu").click(function(){
		$("#openmenu").animate({ opacity: 0 });
		$("#sidemenu").animate({ left: 0 });
	});
	$("#closemenu, #putbeacon, #putcancel, #removebeacon, #notify").click(function(){
		if(!menuSlided){
			$("#openmenu").animate({ opacity: 1 });
			$("#sidemenu").animate({ left: -$("#sidemenu").outerWidth() });
		}
	});

	var menuSlided = false;
	var touchX = 0;
	$("#notify")
		.bind("touchstart", function(e){
			if(e.originalEvent.changedTouches[0].pageX < 32){
				menuSlided = true;
			}
		})
		.bind("touchmove", function(e){
			touchX = e.originalEvent.changedTouches[0].pageX;
			if(menuSlided){
				var max = $("#sidemenu").outerWidth();
				$("#sidemenu").css("left", Math.min(0, touchX - max));
				$("#openmenu").css("opacity", Math.min(1, 1 - touchX/max));
			}
		})
		.bind("touchend", function(e){
			if(menuSlided){
				var max = $("#sidemenu").outerWidth();
				if(touchX > max/2){
					$("#openmenu").animate({ opacity: 0 });
					$("#sidemenu").animate({ left: 0 });
				}else{
					$("#openmenu").animate({ opacity: 1 });
					$("#sidemenu").animate({ left: -$("#sidemenu").outerWidth() });
				}
			}
			menuSlided = false;
		})

	$("#confirm_yes").click(function(){
		confirm_callback(true);
	});
	$("#confirm_no").click(function(){
		confirm_callback(false);
	});


	function rmBeacon(beaconid){
		confirm("remove this beacon?", function(choice){
			if(choice){
				console.log("debug: beacon remove");
			}
		});
	}

	(function animation(){
		if($(".holded_beacon").length > 0){
			var duration = (new Date()) - $(".holded_beacon").data("holdstart");
			$(".holded_beacon").css("background-color", "rgba(0, 0, 0, " + Math.min(0.3, 0.05 + duration / 1000 / 5) + ")");
			if(duration > 1000){
				rmBeacon($(".holded_beacon").data("beaconid"));
				$(".holded_beacon").removeClass("holded_beacon");
				$("#mybeacons li").css({
					backgroundColor: "",
					color: ""
				});
			}
		}

		requestAnimationFrame(animation);
	})();
}

$(function(){
	(function loadingAnimation(){
		var target_opacity = 1.0;
		if($("#loading").css("opacity") == 1.0){
			target_opacity = 0.3;
		}
		$("#loading").animate({ opacity: target_opacity }, { duration: 2000, complete: loadingAnimation });
	})();

	cameraInit();
	threeInit();
	guiInit();

	navigator.geolocation.getCurrentPosition(function(e){
		var lat = e.coords.latitude;
		var lng = e.coords.longitude;
		var alt = e.coords.altitude;
		console.log(lat, lng, alt);

		var near = [];
		for(var i=0; i<50; i++){
			near.push({
				id: i,
				place: [lat+(Math.random()*0.04-0.02), lng+(Math.random()*0.04-0.02), 0],
				owner: ["this", "is", "test"][i%3],
				date: new Date((new Date()) - Math.random()*1000*60*60*24*7)
			});
		}
		var my = [];
		for(var i=0; i<3; i++){
			my.push({
				id: i+100,
				place: [lat+(Math.random()*0.1-0.05), lng+(Math.random()*0.1-0.05), 0],
				owner: "your name",
				date: new Date((new Date()) - Math.random()*1000*60*60*24*30)
			});
		}
		updateBeacons(near, my);

		if($("#loading").length > 0){
			changeMessage("");
		}
	}, function(){
		changeMessage("get location failed<br>please check device settings");
	});
});
