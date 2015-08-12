var scene, camera, renderer, controls;
var beacons = [];

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
			.fadeIn("slow")

	setTimeout(function(){
		added.fadeOut("slow", function(){
			added.fadeOut("slow", function(){
				added.remove();
			});
		});
	}, 3000);
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

function cameraOpen(){
	navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || window.navigator.mozGetUserMedia;

	MediaStreamTrack.getSources(function(data){
		for(var i in data){
			if(data[i].kind == "video" && data[i].facing == "environment"){
				navigator.getUserMedia(
					{ audio: false, video: {
						optional: [{ sourceId: data[i].id }]
					} },
					function(stream){
						document.querySelector('video').src = window.URL.createObjectURL(stream);
					},
					console.log
				);
				return;
			}
		}
		confirm("this device hasn't out camera<br>continue without camera?", function(choice){
			if(choice){
				changeMessage("");
			}else{
				changeMessage("this device hasn't out camera");
			}
		});
	});
}

function positionChange(latitude, longitude, altitude){
	camera.position.x = latitude * 1519.85;
	camera.position.z = longitude * 1519.85;
	camera.position.y = altitude * 1519.85;
}

function updateBeacons(newbeacons){
	beacons.forEach(function(beacon){
		scene.remove(beacon);
	});

	var geo = new THREE.BoxGeometry(1, 1, 1);
	var mat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
	newbeacons.forEach(function(beacon){
		var mesh = new THREE.Mesh(geo, mat);
		mesh.position.x = beacon[0] * 1519.85;
		mesh.position.z = beacon[1] * 1519.85;
		mesh.position.y = beacon[2] * 1519.85;
		scene.add(mesh);
		beacons.push(mesh);
	});

	renderer.render(scene, camera);
}

function threeInit(){
	cameraOpen();

	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
	controls = new THREE.DeviceOrientationControls(camera);

	renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
	renderer.setClearColor(0x000000, 0);
	renderer.setSize(window.innerWidth, window.innerHeight);

	$("main").append(renderer.domElement);

	(function animation(){
		window.requestAnimationFrame(animation);

		navigator.geolocation.getCurrentPosition(function(e){
			positionChange(e.coords.latitude, e.coords.longitude, e.coords.altitude||0);
		});
		controls.update();
		renderer.render(scene, camera);
	})();

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
	$("canvas")
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

	var hold_start = new Date();
	var hold_item = null;
	$("#mybeacons li")
		.bind("touchstart", function(e){
			hold_item = e.currentTarget;
			hold_start = e.timeStamp;
		})
		.mousedown(function(e){
			hold_item = e.currentTarget;
			hold_start = e.timeStamp;
		})
		.bind("touchend", function(e){
			hold_item = null;
			$("#mybeacons li").css("background-color", "rgba(0, 0, 0, 0.05)");
		})
		.mouseup(function(){
			hold_item = null;
			$("#mybeacons li").css("background-color", "rgba(0, 0, 0, 0.05)");
		})
		;

	(function animation(){
		if(hold_item){
			var duration = (new Date()) - hold_start;
			$(hold_item).css("background-color", "rgba(0, 0, 0, " + Math.min(0.3, 0.05 + duration / 1000 / 5) + ")");
			if(duration > 1000){
				hold_item = null;
				$("#mybeacons li").css("background-color", "rgba(0, 0, 0, 0.05)");
				rmBeacon($(hold_item).data("beaconid"));
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

	threeInit();
	guiInit();

	navigator.geolocation.getCurrentPosition(function(e){
		var lat = e.coords.latitude;
		var lng = e.coords.longitude;
		var alt = e.coords.altitude;
		console.log(lat, lng, alt);

		var ls = [];
		for(var i=0; i<100; i++){
			ls.push([lat+(Math.random()*0.02-0.01), lng+(Math.random()*0.02-0.01), (alt||0)+(Math.random()*0.01-0.005)]);
		}
		updateBeacons(ls);

		if($("#loading").length > 0){
			changeMessage("");
		}
	}, function(){
		changeMessage("get location failed.");
	});
});
