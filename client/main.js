var scene, camera, renderer;
var beacon_list = {};
var beacon_models = [];
var mybeacon_list = {};
var current_beacon = null;

function location2meter(x){
	return x * 1519.85;
}

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
				$("#account").animate({ opacity: 0 });
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

function updateIndicator(position, orient){
	if(!position){
		position = this.oldPos;
		if(!position){
			navigator.geolocation.getCurrentPosition(updateIndicator);
		}
	}
	if(!orient){
		orient = this.oldOrient;
	}

	var canv = $("#direction_indicator")[0];
	var ctx = canv.getContext("2d");
	var indicator_size = Math.min(canv.width, canv.height)*0.45;

	var baseAngle = orient ? orient.alpha/180*Math.PI : 0;
	var fov = camera.fov/180*Math.PI;

	ctx.clearRect(0, 0, canv.width, canv.height);

	function putIndicator(beacon){
		var pos = beacon.place;
		var angle = (Math.atan2(pos[0] - position.coords.latitude, pos[1] - position.coords.longitude) - baseAngle + Math.PI*2)%(Math.PI*2);

		ctx.globalAlpha = Math.min(0.9, Math.max(0, Math.abs(angle-Math.PI)/(Math.PI-fov)));

		ctx.fillStyle = "white";
		ctx.beginPath();
		ctx.arc(canv.width/2 + Math.sin(angle)*indicator_size, canv.height/2 + Math.cos(angle)*indicator_size, 5, 0, Math.PI*2, true);
		ctx.fill();

		ctx.fillStyle = ["#ff6666", "#66ff66", "#6666ff"][beacon.type];
		ctx.beginPath();
		ctx.arc(canv.width/2 + Math.sin(angle)*indicator_size, canv.height/2 + Math.cos(angle)*indicator_size, 4, 0, Math.PI*2, true);
		ctx.fill();
	}

	if(current_beacon){
		putIndicator(current_beacon);
	}else{
		for(var x in beacon_list){
			putIndicator(beacon_list[x]);
		}
	}

	this.oldPos = position;
	this.oldOrient = orient;
}

function setBeaconsListEventListener(){
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

		updateIndicator();
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
}

function calcDistances(position){
	if(!position){
		position = this.oldPos;
		if(!position){
			navigator.geolocation.getCurrentPosition(calcDistances);
		}
	}

	$("#nearbeacons li, #mybeacons li").toArray().forEach(function(x){
		if($(x).parent().parent().attr("id") == "mybeacons"){
			var pos = mybeacon_list[x.dataset.id].place;
		}else{
			var pos = beacon_list[x.dataset.id].place;
		}
		var distance = location2meter(Math.sqrt(Math.pow((pos[0]-position.coords.latitude), 2) + Math.pow((pos[1]-position.coords.longitude), 2)));

		$(".distance", x).text(Math.round(distance) + "m");
		$(x).attr("data-distance", distance)
	});

	$("#nearbeacons ul").html($("#nearbeacons li").toArray().sort(function(a,b){ return $(a).data("distance") - $(b).data("distance"); }));

	$("#mybeacons ul").html($("#mybeacons li").toArray().sort(function(a,b){ return $(a).data("distance") - $(b).data("distance"); }));

	setBeaconsListEventListener();

	this.oldPos = position;
}

function updatePosition(position){
	camera.position.x = location2meter(position.coords.latitude);
	camera.position.z = location2meter(position.coords.longitude);
	camera.position.y = 1;

	calcDistances();
	updateIndicator(position, null);

	this.oldPos = position;
}

function rewriteBeacons(){
	var geos = [
		new THREE.OctahedronGeometry(0.5),
		new THREE.OctahedronGeometry(0.5, 1),
		new THREE.DodecahedronGeometry(0.5)
	];
	var frame = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
	var fills = [
		new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: 0.3 }),
		new THREE.MeshBasicMaterial({ color: 0x00ff00, opacity: 0.3 }),
		new THREE.MeshBasicMaterial({ color: 0x0000ff, opacity: 0.3 }),
	];

	function putBeacon(beacon){
		var place = beacon.place;

		var mesh = new THREE.Mesh(geos[beacon.type], frame);
		mesh.position.x = location2meter(place[0]);
		mesh.position.z = location2meter(place[1]);
		mesh.position.y = 0;
		scene.add(mesh);
		beacon_models.push(mesh);

		var mesh = new THREE.Mesh(geos[beacon.type], fills[beacon.type]);
		mesh.position.x = location2meter(place[0]);
		mesh.position.z = location2meter(place[1]);
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

function updateBeacons(){
	function zfill(x){
		return ("0" + x).slice(-2);
	}
	function makeBeaconListItem(beacon){
		return "<li data-id='" + beacon.id + "'><div><div class='owner'>" + beacon.owner + "</div><div class='created'>" + zfill(beacon.date.getMonth()) + "/" + zfill(beacon.date.getDate()) + " " + zfill(beacon.date.getHours()) + ":" + zfill(beacon.date.getMinutes()) + "</div></div><div class='distance'></div></li>";
	}

	getNearBeacons(function(beacons, err){
		if(err){
			showNotify("failed get near beacon list<br>" + err);
		}else{
			beacon_list = {};

			$("#nearbeacons ul").html("");

			beacon_models.forEach(function(model){
				scene.remove(model);
			});

			beacons.forEach(function(beacon){
				beacon_list[beacon.id] = beacon;
				$("#nearbeacons ul").append(makeBeaconListItem(beacon));
			});

			rewriteBeacons();
			calcDistances();

			if($("#loading").length > 0){
				changeMessage("");
			}
		}
	});

	getMyBeacons(function(beacons, err){
		if(err){
			showNotify("failed get my beacon list<br>" + err);
		}else{
			mybeacon_list = {};

			$("#mybeacons ul").html("");

			beacons.forEach(function(beacon){
				mybeacon_list[beacon.id] = beacon;
				$("#mybeacons ul").append(makeBeaconListItem(beacon));
			});

			rewriteBeacons();
			calcDistances();
		}
	});
}

function threeInit(){
	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
	var controls = new THREE.DeviceOrientationControls(camera);

	renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
	renderer.setClearColor(0x000000, 0);
	renderer.setSize(window.innerWidth, window.innerHeight);

	$("main").append(renderer.domElement);

	var indicator = $("#direction_indicator")[0];
	indicator.width = window.innerWidth;
	indicator.height = window.innerHeight;

	(function animation(){
		window.requestAnimationFrame(animation);

		for(var i in beacon_models){
			beacon_models[i].rotation.y += 0.01;
		}

		controls.update();
		renderer.render(scene, camera);
	})();

	navigator.geolocation.watchPosition(updatePosition, function(err){
		$("#account").animate({ opacity: 0 });
		if(err.code == 1){
			changeMessage("couldn't get location data<br>please check settings");
		}else{
			changeMessage("couldn't get location data");
		}
	});

	window.addEventListener('resize', function(){
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();

			renderer.setSize(window.innerWidth, window.innerHeight);

			var indicator = $("#direction_indicator")[0];
			indicator.width = window.innerWidth;
			indicator.height = window.innerHeight;
			updateIndicator(null, null);

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
		if($("#mybeacons li:first").data("distance") < 3){
			showNotify("too near your beacon");
		}else if($("#nearbeacons li:first").data("distance") < 1){
			showNotify("too near other beacon");
		}else{
			putBeacon($(this).data("type"), function(){
				showNotify("put beacon here");
				updateBeacons();
			});
		}
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


	$("#username").click(function(){
		$("#changeid_username").val(getUserInfo().name);
		$("#account > div").css("display", "none");
		$("#changeid").css("display", "block");
		$("#account")
			.css({
				display: "flex",
				opacity: 0
			})
			.animate({ opacity: 1 })
	});
	function changeName(){
		if(($("#changeid_username").val() != getUserInfo().name && $("#changeid_username").val() != "") || $("#changeid_password").val() != ""){
			updateUserInfo({
					name: $("#changeid_username").val() || null,
					password: $("#changeid_password").val() || null
				}, function(err){
					$("#account").animate({ opacity: 0 }, function(){
						$("#account").css("display", "none");
					});
					if(err){
						showNotify("failed change account info<br>" + err);
					}else{
						showNotify("success");
						$("#username span").text(getUserInfo().name);
					}
				});
		}else{
			$("#account").animate({ opacity: 0 }, function(){
				$("#account").css("display", "none");
			});
		}
	}
	$("#changeid_button").click(changeName);
	$("#changeid input").keyup("input", function(e){
		if(e.keyCode == 13){
			changeName();
		}else{
			setTimeout(function(){
				var name_changed = $("#changeid_username").val() != getUserInfo().name && $("#changeid_username").val() != "";
				var pass_changed = $("#changeid_password").val() != "";

				if(name_changed && pass_changed){
					$("#changeid_button").text("change ID/password");
				}else if(name_changed){
					$("#changeid_button").text("change ID");
				}else if(pass_changed){
					$("#changeid_button").text("change password");
				}else{
					$("#changeid_button").text("cancel");
				}
			}, 100);
		}
	});

	$("#account").css("display", "flex");
	$("#account > div").css("display", "none");
	$("#login").css("display", "block");

	function doLogin(){
		login($("#login_username").val(), $("#login_password").val(), function(err){
			if(err){
				$("#login_message")
					.text(err)
					.css("display", "block");
			}else{
				$("#account").animate({ opacity: 0 }, function(){
					$("#account").css("display", "none");
				});
				$("#username span").text(getUserInfo().name);
				updateBeacons();
			}
		});
	}
	$("#login input").keyup("input", function(e){
		if(e.keyCode == 13){
			doLogin();
		}
	});
	$("#login_button").click(doLogin);
	$("#create_button").click(function(){
		createAccount({
			name: $("#login_username").val(),
			password: $("#login_password").val()
		}, function(err){
			if(err){
				$("#login_message")
					.text(err)
					.css("display", "block");
			}else{
				$("#account").animate({ opacity: 0 }, function(){
					$("#account").css("display", "none");
				});
				showNotify("created account<br>welcome " + getUserInfo().name);
				$("#username span").text(getUserInfo().name);
				updateBeacons();
			}
		});
	});


	window.addEventListener('deviceorientation', function(event) {
		  updateIndicator(null, event);
	});


	function rmBeacon(beaconid){
		confirm("remove this beacon?", function(choice){
			if(choice){
				removeBeacon(beaconid, function(err){
					if(!err){
						showNotify("beacon removed");
						updateBeacons();
					}else{
						showNotify("failed beacon remove<br>" + err);
					}
				});
			}
		});
	}

	(function animation(){
		if($(".holded_beacon").length > 0){
			var duration = (new Date()) - $(".holded_beacon").data("holdstart");
			$(".holded_beacon").css("background-color", "rgba(0, 0, 0, " + Math.min(0.3, 0.05 + duration / 1000 / 5) + ")");
			if(duration > 1000){
				rmBeacon($(".holded_beacon").data("id"));
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
	if(!navigator.geolocation){
		$("#account").animate({ opacity: 0 });
		changeMessage("this browser doesn't supported geolocation");
	}

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

	setInterval(updateBeacons, 10000);
	updateBeacons();
	addConnectListener(function(){
		if(currentMessage() == "disconnect"){
			changeMessage("");
		}
		updateBeacons();
	});

	addDisconnectListener(function(){
		changeMessage("disconnect");
	});
});
