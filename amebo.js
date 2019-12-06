//amebo gameboy colour emulator by riperiperi
//"use strict"; despite my code conforming to strict mode, i'll keep it off because it just adds stupid extra checks which might slow things down

window.onerror = function myErrorHandler(errorMsg, url, lineNumber) {
	alert(errorMsg+" on line "+lineNumber);
}

window.GBMasterClass = function() {

	var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
								window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
	window.requestAnimationFrame = requestAnimationFrame;

	this.gameboys = [];

	var gameboys = this.gameboys;

	function update() {
		if (gameboys.length > 1) multiGBUpdate();
		else if (gameboys.length == 1) gameboys[0].audioSyncUpdate();
		window.requestAnimationFrame(update);
	}

	function multiGBUpdate() {
		var gbl = gameboys.length

		for (var gbn=0; gbn<gbl; gbn++) {
			if (!(gameboys[gbn].options.cButByte)) gameboys[gbn].prepareButtonByte();
		}
		var mostCycles = 0;
		while (mostCycles<70224) {
			for (var gbn=0; gbn<gbl; gbn++) {
				while (gameboys[gbn].frameCycles <= Math.min(mostCycles, 70223)) gameboys[gbn].cycle();
				mostCycles = gameboys[gbn].frameCycles
			}
		}
		for (var gbn=0; gbn<gbl; gbn++) {
			gameboys[gbn].frameCycles -= 70224;
		}
	}

	window.requestAnimationFrame(update);
}

window.gb = function(file, canvas, options) {

	//alert(checkEndian());

	if (options == null) {
		var options = {rootDir:""}
	}
	this.options = options;

	if (typeof window.GBMaster == "undefined") window.GBMaster = new window.GBMasterClass();

	var sadGB = "data:image/gif;base64,R0lGODlhGQArAIAAAP///wAAACH5BAAHAP8ALAAAAAAZACsAAAKORI6pewYPo5yvGYZRDTf721Gi1mjiRHKmKrFhaTkolIYOF7m1eeawTaugfjwarkWM9Taq5pGpfDlzSGMTeMLtor2tJwNSUI5i2BcD6pwTmyG4ulxy43D6iPy0x+aj9iLuVdQSlFY4FrWXN1NnN9R493gY6Xg4JaSlKHdjqCfDl7X5CYqZqeck6IYKxUBRAAA7";
	//image used for errors, takes up space but you've got to love it tho

	this.RSToff = 0; //used by gbs player
	this.paused = false;
	this.loadState = loadState;
	this.saveState = saveState;

	window.addEventListener("unload", saveBattery)
	var GBObj = this;

	this.loadROM = function(url, pauseAfter) {
		var loadfile = new XMLHttpRequest();
		loadfile.open("GET", url);
		loadfile.responseType = "arraybuffer";
		loadfile.send();

		var filename = url.split("/");
		GBObj.filename = filename[filename.length-1];
		GBObj.paused = true;

		loadfile.onprogress = drawProgress;
		loadfile.onreadystatechange = function() {this.mime = this.getResponseHeader('content-type');};
		loadfile.onload = function() {
			GBObj.paused = (pauseAfter||false);
			if ((loadfile.mime == "application/zip") && (JSZip != null)) {
				var zip = new JSZip(loadfile.response);
				var file = zip.file(/.gb/)[0];
				GBObj.filename = file.name;
				GBObj.loadROMBuffer(file.asArrayBuffer()); //load first file with extension .gb or .gbc
			} else GBObj.loadROMBuffer(loadfile.response);
		}
		loadfile.onerror = function() {
			alert("Failed to load "+url+"! Are CORS requests enabled on the server?")
		}
	}

	this.loadROMBuffer = function(buffer, battery) { //battery is an optional parameter
		if (buffer instanceof ArrayBuffer) game = new Uint8Array(buffer);
		else if (buffer instanceof Uint8Array) game = buffer;
		else alert(buffer);
		GBObj.game = game;
		gameLoaded = true;
		if (battery != null) {
			ROMID = generateUniqueName();
			CRAM = new Uint8Array(battery);
			saveBattery();
		}
		if (biosLoaded == 2) init();
	}

	var internalCanvas = document.createElement("canvas");
	internalCanvas.width = 160;
	internalCanvas.height = 144;
	this.internalCanvas = internalCanvas;
	var internalCtx = internalCanvas.getContext("2d");

	if (canvas == null) canvas = internalCanvas; //if we have no output, display to self.
	this.canvas = canvas; //output canvas
	var ctx = canvas.getContext("2d");

	if (typeof ctx.webkitImageSmoothingEnabled != "undefined") {
		ctx.webkitImageSmoothingEnabled = false;
	} else if (typeof ctx.imageSmoothingEnabled != "undefined") {
		ctx.imageSmoothingEnabled = false;
	} else {
		console.log("imageSmoothingEnabled not supported, falling back to css scaling")
		canvas.style.width = canvas.width+"px";
		canvas.style.height = canvas.height+"px";
		canvas.width = 160;
		canvas.height = 144;
	}

	this.ctx = ctx;
	var colours = [[219, 255, 134, 255], [194, 226, 33, 255], [73, 156, 27, 255], [15, 86, 47, 255]]
	this.file = file;
	var gameLoaded = false;
	var biosLoaded = 0;
	var GBAudioContext = null;

	var getGamepads = navigator.webkitGamepads || navigator.webkitGetGamepads || navigator.getGamepads;

	var p = navigator.platform
	var iOS = ( p === 'iPad' || p === 'iPhone' || p === 'iPod' );
	if (iOS) setInterval(saveBattery, 1000);

	var NoAudioAPI = false;
	if (typeof AudioContext !== 'undefined') {
		GBAudioContext = new AudioContext();
	} else if (typeof webkitAudioContext !== 'undefined') {
		GBAudioContext = new webkitAudioContext();
	} else {
		NoAudioAPI = true;
	}
  
	var stereo = true;
	//if (iOS) NoAudioAPI = true;

	if (NoAudioAPI) {
		//audio api is so integrated that i have to make all nodes dummy objects to keep things functioning
		//since the AudioEngine objects are still used in audio emulation (which is still needed)
		//please forgive me for this hacky disaster

		GBAudioContext = {
			createGain: function() { return { gain:{value:0}, connect:function(){} } },
			createChannelMerger: function(a) { return { connect:function(){} } },
			createScriptProcessor: function(a, b, c) { return { connect:function(){} } },
			sampleRate: 0 //this will make cyclesForSample equal infinity, and no audio will ever be produced. ;)
		}
	}

  /*
	window.addEventListener('touchstart', function() {
    if (!NoAudioAPI) return;
    NoAudioAPI = false;
    if (typeof AudioContext !== 'undefined') {
      GBAudioContext = new AudioContext();
    } else if (typeof webkitAudioContext !== 'undefined') {
      GBAudioContext = new webkitAudioContext();
    } else {
      NoAudioAPI = true;
    }
    
		var buffer = GBAudioContext.createBuffer(1, 1, 22050);
		var source = GBAudioContext.createBufferSource();
		source.buffer = buffer;

		source.connect(GBAudioContext.destination);
		source.start(0);
	}, false);
  */
	
	this.scopeEval = function(code) {return eval(code)}

	var registers, flags, SP, PC, Cycles, IME, game, bios, CGBbios, MemRead, MemWrite, VRAM, RAM, OAM, IORAM, ZRAM, CRAM, biosActive, 
	vblankComplete, lineCycles, GBScreen, buttonByte, paused, masterClock, frameskip, timeStart, sampleNumber, 
	MBC, MBCReadHandler, MBCWriteHandler, AudioEngine, AudioMerge, soundLout, soundRout, audioSampleRate, LCDstate, halted,
	palettes, palettesInt32, ROMID, timerCounts, WaveRAMCycles, CGB, CGBDMA, CPUSpeed, CGBBGPal, CGBBGPalReg, CGBSprPal, CGBSprPalReg,
	tileLayerData = new Uint8Array(160), tileLayerPalette = new Uint8Array(160), emptyTileLayer = new Uint8Array(160), bufferSize,
	audioSyncFrames, soundCycles, soundPhase, timerCycles, audioCycles, cyclesForSample, divCounts, CGBInt32BG, CGBInt32Spr

	var registerDebug, instCount;

	GBScreen = internalCtx.createImageData(160, 144);
	var EmptyImageBuffer = new Uint8Array(GBScreen.data.length);
	var GBScreenInt32 = new Uint32Array(GBScreen.data.buffer);

	var keyConfig = {
		A: 88,
		B: 90,
		SELECT: 32,
		START: 13,
		UP: 38,
		DOWN: 40,
		LEFT: 37,
		RIGHT: 39
	}

	this.keyConfig = keyConfig; //allow public access

	var controlKeyConfig = {
		STATES: [112, 113, 114, 115, 116, 117, 118, 119, 120, 121]
	}

	if (file != null) this.loadROM(file);

	var loadbios = new XMLHttpRequest();
	loadbios.open("GET", options.rootDir+"dmgbios.bin");
	loadbios.responseType = "arraybuffer";
	loadbios.send();
	loadbios.onload = function() {
		if (loadbios.status == 200) bios = new Uint8Array(loadbios.response);
		biosLoaded++;
		if (gameLoaded && (biosLoaded == 2)) init();
	}
	loadbios.onerror = function() {
		biosLoaded++;
		if (gameLoaded && (biosLoaded == 2)) init();
	}

	var loadCGBbios = new XMLHttpRequest();
	loadCGBbios.open("GET", options.rootDir+"gbcbios.bin");
	loadCGBbios.responseType = "arraybuffer";
	loadCGBbios.send();
	loadCGBbios.onload = function() {
		if (loadCGBbios.status == 200) CGBbios = new Uint8Array(loadCGBbios.response);
		biosLoaded++;
		if (gameLoaded && (biosLoaded == 2)) init();
	}
	loadCGBbios.onerror = function() {
		biosLoaded++;
		if (gameLoaded && (biosLoaded == 2)) init();
	}

	var keysArray = new Array(256);
	for (var i=0; i<256; i++) {
		keysArray[i] = 1;
	}
	document.addEventListener("keydown", keyDownHandler, false);
	document.addEventListener("keyup", keyUpHandler, false);

	function keyDownHandler(evt) {
		keysArray[evt.keyCode] = 0;

		var stateNum = controlKeyConfig.STATES.indexOf(evt.keyCode)
		if (stateNum != -1) {
			evt.preventDefault();
			if (keysArray[16] == 0) {
				localStorage["states/"+stateNum] = JSON.stringify(saveState());
			} else {
				var tstate = localStorage["states/"+stateNum];
				if (typeof tstate != "undefined") loadState(JSON.parse(tstate));
			}
		}

	}
  
  this.handleKeyDown = function(keyCode) {
    keyDownHandler({keyCode: keyCode, preventDefault: function(){}});
  }

	function keyUpHandler(evt) {
		keysArray[evt.keyCode] = 1;
	}
  
  this.handleKeyUp = function(keyCode) {
    keyUpHandler({keyCode: keyCode, preventDefault: function(){}});
  }

	function getROMName() {
		var name = "";
		for (var i=0x134; i<=0x143; i++) {
			if (game[i] == 0) break;
			name += String.fromCharCode(game[i])
		}
		return name;
	}

	function generateUniqueName() {
		var sum = 0;
		for (var i=0; i<game.length; i++) {
			sum = (sum + game[i])%4294967295
		}
		var name = "";
		for (var i=0x134; i<=0x143; i++) {
			name += String.fromCharCode(game[i])
		}
		return name+sum;
	}

	var Instructions = //cue ridiculously large table
	[
		NOP, function(){LD16M(1)}, function(){LDMA(1)}, function(){INC16(1)}, function(){INC(1)}, function(){DEC(1)}, function(){LDM(1)}, function(){RLC(0); flags[0] = 0}, LDSP, function(){ADDHL16(1)}, function(){LDAM(1)}, function(){DEC16(1)}, function(){INC(2)}, function(){DEC(2)}, function(){LDM(2)}, function(){RRC(0); flags[0] = 0},
		STOP, function(){LD16M(3)}, function(){LDMA(3)}, function(){INC16(3)}, function(){INC(3)}, function(){DEC(3)}, function(){LDM(3)}, function(){RL(0); flags[0] = 0}, function(){JR(4, 1)}, function(){ADDHL16(3)}, function(){LDAM(3)}, function(){DEC16(3)}, function(){INC(4)}, function(){DEC(4)}, function(){LDM(4)}, function(){RR(0); flags[0] = 0},
		function(){JR(0, 0)}, function(){LD16M(5)}, function(){LDMA(5); CHL(1)}, function(){INC16(5)}, function(){INC(5)}, function(){DEC(5)}, function(){LDM(5)}, DAA, function(){JR(0, 1)}, function(){ADDHL16(5)}, function(){LDAM(5); CHL(1)}, function(){DEC16(5)}, function(){INC(6)}, function(){DEC(6)}, function(){LDM(6)}, CPL,
		function(){JR(3, 0)}, LDSPM, function(){LDMA(5); CHL(-1)}, INCSP, INCHL, DECHL, LDHLM, SCF, function(){JR(3, 1)}, ADDHLSP, function(){LDAM(5); CHL(-1)}, DECSP, function(){INC(0)}, function(){DEC(0)}, function(){LDM(0)}, CCF,
		function(){LD(1, 1)}, function(){LD(1, 2)}, function(){LD(1, 3)}, function(){LD(1, 4)}, function(){LD(1, 5)}, function(){LD(1, 6)}, function(){LDFHL(1)}, function(){LD(1, 0)}, function(){LD(2, 1)}, function(){LD(2, 2)}, function(){LD(2, 3)}, function(){LD(2, 4)}, function(){LD(2, 5)}, function(){LD(2, 6)}, function(){LDFHL(2)}, function(){LD(2, 0)},
		function(){LD(3, 1)}, function(){LD(3, 2)}, function(){LD(3, 3)}, function(){LD(3, 4)}, function(){LD(3, 5)}, function(){LD(3, 6)}, function(){LDFHL(3)}, function(){LD(3, 0)}, function(){LD(4, 1)}, function(){LD(4, 2)}, function(){LD(4, 3)}, function(){LD(4, 4)}, function(){LD(4, 5)}, function(){LD(4, 6)}, function(){LDFHL(4)}, function(){LD(4, 0)},
		function(){LD(5, 1)}, function(){LD(5, 2)}, function(){LD(5, 3)}, function(){LD(5, 4)}, function(){LD(5, 5)}, function(){LD(5, 6)}, function(){LDFHL(5)}, function(){LD(5, 0)}, function(){LD(6, 1)}, function(){LD(6, 2)}, function(){LD(6, 3)}, function(){LD(6, 4)}, function(){LD(6, 5)}, function(){LD(6, 6)}, function(){LDFHL(6)}, function(){LD(6, 0)},
		function(){LDTHL(1)}, function(){LDTHL(2)}, function(){LDTHL(3)}, function(){LDTHL(4)}, function(){LDTHL(5)}, function(){LDTHL(6)}, HALT, function(){LDTHL(0)}, function(){LD(0, 1)}, function(){LD(0, 2)}, function(){LD(0, 3)}, function(){LD(0, 4)}, function(){LD(0, 5)}, function(){LD(0, 6)}, function(){LDFHL(0)}, function(){LD(0, 0)},
		function(){ADD(1)}, function(){ADD(2)}, function(){ADD(3)}, function(){ADD(4)}, function(){ADD(5)}, function(){ADD(6)}, ADDHL, function(){ADD(0)}, function(){ADC(1)}, function(){ADC(2)}, function(){ADC(3)}, function(){ADC(4)}, function(){ADC(5)}, function(){ADC(6)}, ADCHL, function(){ADC(0)},  
		function(){SUB(1)}, function(){SUB(2)}, function(){SUB(3)}, function(){SUB(4)}, function(){SUB(5)}, function(){SUB(6)}, SUBHL, function(){SUB(0)}, function(){SBC(1)}, function(){SBC(2)}, function(){SBC(3)}, function(){SBC(4)}, function(){SBC(5)}, function(){SBC(6)}, SBCHL, function(){SBC(0)},  
		function(){AND(1)}, function(){AND(2)}, function(){AND(3)}, function(){AND(4)}, function(){AND(5)}, function(){AND(6)}, ANDHL, function(){AND(0)}, function(){XOR(1)}, function(){XOR(2)}, function(){XOR(3)}, function(){XOR(4)}, function(){XOR(5)}, function(){XOR(6)}, XORHL, function(){XOR(0)},  
		function(){OR(1)}, function(){OR(2)}, function(){OR(3)}, function(){OR(4)}, function(){OR(5)}, function(){OR(6)}, ORHL, function(){OR(0)}, function(){CP(1)}, function(){CP(2)}, function(){CP(3)}, function(){CP(4)}, function(){CP(5)}, function(){CP(6)}, CPHL, function(){CP(0)},  
		function(){RET(0, 0)}, function(){POP(1)}, function(){JP(0, 0)}, function(){JP(4, 1)}, function(){CALL(0, 0)}, function(){PUSH(1)}, ADDM, function(){RST(0)}, function(){RET(0, 1)}, NRET, function(){JP(0, 1)}, PrefixCB, function(){CALL(0, 1)}, function(){CALL(4, 1)}, ADCM, function(){RST(8)},
		function(){RET(3, 0)}, function(){POP(3)}, function(){JP(3, 0)}, UNIMP, function(){CALL(3, 0)}, function(){PUSH(3)}, SUBM, function(){RST(16)}, function(){RET(3, 1)}, function(){EI(); NRET()}, function(){JP(3, 1)}, UNIMP, function(){CALL(3, 1)}, UNIMP, SBCM, function(){RST(24)},
		LDH_M_A, function(){POP(5)}, LDH_C_A, UNIMP, UNIMP, function(){PUSH(5)}, ANDM, function(){RST(32)}, ADDSP, JPHL, LD_M_A, UNIMP, UNIMP, UNIMP, XORM, function(){RST(40)},
		LDH_A_M, POPAF, LDH_A_C, DI, UNIMP, PUSHAF, ORM, function(){RST(48)}, LD_HL_SPM, LDSPHL, LD_A_M, EI, UNIMP, UNIMP, CPM, function(){RST(56)}
	]

	var PrefixCBI =
	[
		function(){RLC(1)}, function(){RLC(2)}, function(){RLC(3)}, function(){RLC(4)}, function(){RLC(5)}, function(){RLC(6)}, RLCHL, function(){RLC(0)}, function(){RRC(1)}, function(){RRC(2)}, function(){RRC(3)}, function(){RRC(4)}, function(){RRC(5)}, function(){RRC(6)}, RRCHL, function(){RRC(0)}, 
		function(){RL(1)}, function(){RL(2)}, function(){RL(3)}, function(){RL(4)}, function(){RL(5)}, function(){RL(6)}, RLHL, function(){RL(0)}, function(){RR(1)}, function(){RR(2)}, function(){RR(3)}, function(){RR(4)}, function(){RR(5)}, function(){RR(6)}, RRHL, function(){RR(0)}, 
		function(){SLA(1)}, function(){SLA(2)}, function(){SLA(3)}, function(){SLA(4)}, function(){SLA(5)}, function(){SLA(6)}, SLAHL, function(){SLA(0)},function(){SRA(1)}, function(){SRA(2)}, function(){SRA(3)}, function(){SRA(4)}, function(){SRA(5)}, function(){SRA(6)}, SRAHL, function(){SRA(0)}, 
		function(){SWAP(1)}, function(){SWAP(2)}, function(){SWAP(3)}, function(){SWAP(4)}, function(){SWAP(5)}, function(){SWAP(6)}, SWAPHL, function(){SWAP(0)},function(){SRL(1)}, function(){SRL(2)}, function(){SRL(3)}, function(){SRL(4)}, function(){SRL(5)}, function(){SRL(6)}, SRLHL, function(){SRL(0)}, 
		function(){BIT(0, 1)}, function(){BIT(0, 2)}, function(){BIT(0, 3)}, function(){BIT(0, 4)}, function(){BIT(0, 5)}, function(){BIT(0, 6)}, function(){BITHL(0)}, function(){BIT(0, 0)}, function(){BIT(1, 1)}, function(){BIT(1, 2)}, function(){BIT(1, 3)}, function(){BIT(1, 4)}, function(){BIT(1, 5)}, function(){BIT(1, 6)}, function(){BITHL(1)}, function(){BIT(1, 0)}, 
		function(){BIT(2, 1)}, function(){BIT(2, 2)}, function(){BIT(2, 3)}, function(){BIT(2, 4)}, function(){BIT(2, 5)}, function(){BIT(2, 6)}, function(){BITHL(2)}, function(){BIT(2, 0)}, function(){BIT(3, 1)}, function(){BIT(3, 2)}, function(){BIT(3, 3)}, function(){BIT(3, 4)}, function(){BIT(3, 5)}, function(){BIT(3, 6)}, function(){BITHL(3)}, function(){BIT(3, 0)},
		function(){BIT(4, 1)}, function(){BIT(4, 2)}, function(){BIT(4, 3)}, function(){BIT(4, 4)}, function(){BIT(4, 5)}, function(){BIT(4, 6)}, function(){BITHL(4)}, function(){BIT(4, 0)}, function(){BIT(5, 1)}, function(){BIT(5, 2)}, function(){BIT(5, 3)}, function(){BIT(5, 4)}, function(){BIT(5, 5)}, function(){BIT(5, 6)}, function(){BITHL(5)}, function(){BIT(5, 0)}, 
		function(){BIT(6, 1)}, function(){BIT(6, 2)}, function(){BIT(6, 3)}, function(){BIT(6, 4)}, function(){BIT(6, 5)}, function(){BIT(6, 6)}, function(){BITHL(6)}, function(){BIT(6, 0)}, function(){BIT(7, 1)}, function(){BIT(7, 2)}, function(){BIT(7, 3)}, function(){BIT(7, 4)}, function(){BIT(7, 5)}, function(){BIT(7, 6)}, function(){BITHL(7)}, function(){BIT(7, 0)},
		function(){RES(0, 1)}, function(){RES(0, 2)}, function(){RES(0, 3)}, function(){RES(0, 4)}, function(){RES(0, 5)}, function(){RES(0, 6)}, function(){RESHL(0)}, function(){RES(0, 0)}, function(){RES(1, 1)}, function(){RES(1, 2)}, function(){RES(1, 3)}, function(){RES(1, 4)}, function(){RES(1, 5)}, function(){RES(1, 6)}, function(){RESHL(1)}, function(){RES(1, 0)}, 
		function(){RES(2, 1)}, function(){RES(2, 2)}, function(){RES(2, 3)}, function(){RES(2, 4)}, function(){RES(2, 5)}, function(){RES(2, 6)}, function(){RESHL(2)}, function(){RES(2, 0)}, function(){RES(3, 1)}, function(){RES(3, 2)}, function(){RES(3, 3)}, function(){RES(3, 4)}, function(){RES(3, 5)}, function(){RES(3, 6)}, function(){RESHL(3)}, function(){RES(3, 0)},
		function(){RES(4, 1)}, function(){RES(4, 2)}, function(){RES(4, 3)}, function(){RES(4, 4)}, function(){RES(4, 5)}, function(){RES(4, 6)}, function(){RESHL(4)}, function(){RES(4, 0)}, function(){RES(5, 1)}, function(){RES(5, 2)}, function(){RES(5, 3)}, function(){RES(5, 4)}, function(){RES(5, 5)}, function(){RES(5, 6)}, function(){RESHL(5)}, function(){RES(5, 0)}, 
		function(){RES(6, 1)}, function(){RES(6, 2)}, function(){RES(6, 3)}, function(){RES(6, 4)}, function(){RES(6, 5)}, function(){RES(6, 6)}, function(){RESHL(6)}, function(){RES(6, 0)}, function(){RES(7, 1)}, function(){RES(7, 2)}, function(){RES(7, 3)}, function(){RES(7, 4)}, function(){RES(7, 5)}, function(){RES(7, 6)}, function(){RESHL(7)}, function(){RES(7, 0)},
		function(){SET(0, 1)}, function(){SET(0, 2)}, function(){SET(0, 3)}, function(){SET(0, 4)}, function(){SET(0, 5)}, function(){SET(0, 6)}, function(){SETHL(0)}, function(){SET(0, 0)}, function(){SET(1, 1)}, function(){SET(1, 2)}, function(){SET(1, 3)}, function(){SET(1, 4)}, function(){SET(1, 5)}, function(){SET(1, 6)}, function(){SETHL(1)}, function(){SET(1, 0)}, 
		function(){SET(2, 1)}, function(){SET(2, 2)}, function(){SET(2, 3)}, function(){SET(2, 4)}, function(){SET(2, 5)}, function(){SET(2, 6)}, function(){SETHL(2)}, function(){SET(2, 0)}, function(){SET(3, 1)}, function(){SET(3, 2)}, function(){SET(3, 3)}, function(){SET(3, 4)}, function(){SET(3, 5)}, function(){SET(3, 6)}, function(){SETHL(3)}, function(){SET(3, 0)},
		function(){SET(4, 1)}, function(){SET(4, 2)}, function(){SET(4, 3)}, function(){SET(4, 4)}, function(){SET(4, 5)}, function(){SET(4, 6)}, function(){SETHL(4)}, function(){SET(4, 0)}, function(){SET(5, 1)}, function(){SET(5, 2)}, function(){SET(5, 3)}, function(){SET(5, 4)}, function(){SET(5, 5)}, function(){SET(5, 6)}, function(){SETHL(5)}, function(){SET(5, 0)}, 
		function(){SET(6, 1)}, function(){SET(6, 2)}, function(){SET(6, 3)}, function(){SET(6, 4)}, function(){SET(6, 5)}, function(){SET(6, 6)}, function(){SETHL(6)}, function(){SET(6, 0)}, function(){SET(7, 1)}, function(){SET(7, 2)}, function(){SET(7, 3)}, function(){SET(7, 4)}, function(){SET(7, 5)}, function(){SET(7, 6)}, function(){SETHL(7)}, function(){SET(7, 0)},
	]

	// ----- State Load/Save -----

	function byteToString(byteArray, noBase64) {
		if (typeof byteArray == "undefined") return;
		var string = ""
		for (var i=0; i<byteArray.length; i++) {
			string += String.fromCharCode(byteArray[i]);
		}
		return (noBase64||false)?string:btoa(string); //i have to base64 encode because JSON.stringify encodes unusual characters like \u1234
	}

	function stringToByte(string, noBase64) {
		var string = (noBase64||false)?string:atob(string);
		if (typeof string == "undefined") return; //so incomplete states don't cause errors.
		var byteArray = new Uint8Array(string.length)
		for (var i=0; i<byteArray.length; i++) {
			byteArray[i] = string.charCodeAt(i);
		}
		return byteArray;
	}

	function saveState() {
		return {
			VRAM: byteToString(VRAM),
			RAM: byteToString(RAM),
			OAM: byteToString(OAM),
			IORAM: byteToString(IORAM),
			ZRAM: byteToString(ZRAM),
			CRAM: byteToString(CRAM) || "",

			CGBDMA: CGBDMA,
			CGBBGPalReg: byteToString(CGBBGPalReg) || "",
			CGBSprPalReg: byteToString(CGBSprPalReg) || "",
			CPUSpeed: CPUSpeed,

			MBC: MBC,
			
			registers: byteToString(registers),
			flags: flags,
			SP: SP,
			PC: PC,
			biosActive: biosActive,
			IME: IME,
			LCDstate: LCDstate,

			CycleTimers: {
				masterClock: masterClock,
				lineCycles: lineCycles,
				soundCycles: soundCycles,
				soundPhase: soundPhase,
				timerCycles: timerCycles,
				audioCycles: audioCycles,
				divCounts: divCounts,
				//timerCounts: timerCounts
			},

			AudioEngine: objectifyAudioEngine()
		};

	}

	function loadState(obj) {
		VRAM = stringToByte(obj.VRAM);
		RAM = stringToByte(obj.RAM);
		OAM = stringToByte(obj.OAM);
		IORAM = stringToByte(obj.IORAM);
		ZRAM = stringToByte(obj.ZRAM);
		CRAM = stringToByte(obj.CRAM);

		if (CGB) {
			CGBDMA = obj.CGBDMA;
			CGBBGPalReg = stringToByte(obj.CGBBGPalReg);
			CGBSprPalReg = stringToByte(obj.CGBSprPalReg);
			CPUSpeed = obj.CPUSpeed;
			restorePal(CGBBGPalReg, CGBBGPal);
			restorePal(CGBSprPalReg, CGBSprPal);
		}

		MBC = obj.MBC;
			
		registers = stringToByte(obj.registers);
		flags = obj.flags;
		SP = obj.SP;
		PC = obj.PC;
		biosActive = obj.biosActive;
		IME = obj.IME;
		LCDstate = obj.LCDstate;

		masterClock = obj.CycleTimers.masterClock;
		lineCycles = obj.CycleTimers.lineCycles;
		soundCycles = obj.CycleTimers.soundCycles;
		soundPhase = obj.CycleTimers.soundPhase;
		timerCycles = obj.CycleTimers.timerCycles;
		audioCycles = obj.CycleTimers.audioCycles;
		divCounts = obj.CycleTimers.divCounts;
		//timerCounts = obj.CycleTimers.timerCounts;

		restoreAudioEngine(obj.AudioEngine);
		audioSyncFrames = 0;
		cyclesForSample = (4194304*CPUSpeed)/audioSampleRate;

		palettes.set(readDMGPalette(0), 0);
		palettes.set(readDMGPalette(1), 16);
		palettes.set(readDMGPalette(2), 32);

	}

	function restorePal(reg, dest) {
		for (var i=0; i<32; i++) {
			var mult = 8.225806451612904;
			dest.set([Math.round((reg[i*2]&0x1F)*mult), Math.round(((reg[i*2]>>5)+((reg[i*2+1]&3)<<3))*mult), Math.round(((reg[i*2+1]&0x7C)>>2)*mult), 255], i*4);
			//dest[i] = [Math.round((reg[i*2]&0x1F)*mult), Math.round(((reg[i*2]>>5)+((reg[i*2+1]&3)<<3))*mult), Math.round(((reg[i*2+1]&0x7C)>>2)*mult)]
		}
	}

	function testSaveState() {
		savewhatever = JSON.stringify(saveState());
	}

	function testLoadState() {
		loadState(JSON.parse(savewhatever));
	}

	function objectifyAudioEngine() {
		var obj = {}
		if (typeof AudioEngine == "undefined") return null;

		for (var i=0; i<4; i++) {
			obj[i] = {
				frequency: AudioEngine[i].frequency,
				duty: AudioEngine[i].duty,
				phase: AudioEngine[i].phase,
				volume: AudioEngine[i].volume,
				lEnable: AudioEngine[i].lEnable,
				rEnable: AudioEngine[i].rEnable,

				esweep: AudioEngine[i].esweep,
				freqreg: AudioEngine[i].freqreg,
				fsweep: AudioEngine[i].fsweep,
				lengthCtr: AudioEngine[i].lengthCtr,
				volreg: AudioEngine[i].volreg,

				sampleNumber: AudioEngine[i].sampleNumber
			};
		}
		obj[3].LFSR = AudioEngine[3].LFSR
		obj[3].frequency = AudioEngine[3].frequency

		obj.lVolume = AudioEngine.lVolume;
		obj.rVolume = AudioEngine.rVolume;
		obj.avgVol = AudioEngine.avgVol;
		return obj;
	}

	function restoreAudioEngine(obj) {
		for (var i=0; i<4; i++) {
			AudioEngine[i].frequency = obj[i].frequency;
			AudioEngine[i].duty = obj[i].duty;
			AudioEngine[i].phase = obj[i].phase;
			AudioEngine[i].volume = obj[i].volume;

			AudioEngine[i].lEnable = obj[i].lEnable;
			AudioEngine[i].rEnable = obj[i].rEnable;

			AudioEngine[i].esweep = obj[i].esweep;
			AudioEngine[i].freqreg = obj[i].freqreg;
			AudioEngine[i].fsweep = obj[i].fsweep;
			AudioEngine[i].lengthCtr = obj[i].lengthCtr;
			AudioEngine[i].volreg = obj[i].volreg;

			AudioEngine[i].sampleNumber = obj[i].sampleNumber;
		}
		AudioEngine[3].LFSR = obj[3].LFSR;
		AudioEngine[3].frequency = obj[3].frequency;

		AudioEngine.lVolume = obj.lVolume;
		AudioEngine.rVolume = obj.rVolume;
		AudioEngine.avgVol = obj.avgVol;
	}


	// ----- I/O EMULATION -----
	var IOReadFunctions = [];
	var IOWriteFunctions = [];

	IOWriteFunctions[0x04] = function(a, b){
		IORAM[b] = 0;
	};

	IOWriteFunctions[0x07] = function(a, b){
		//if ((a&4) ^ (IORAM[0x07]&4)) timerCounts = 0;
		IORAM[b] = a;
	};

	IOReadFunctions[0x05] = function(a) {
		return IORAM[a];
	}

	IOWriteFunctions[0x43] = function(a, b) {
		IORAM[b] = a;
	}

	IOWriteFunctions[0x40] = function(a, b){
		if ((IORAM[0x40]&0x80) != (a&0x80)) {
			if (a&0x80) {
				IORAM[0x44] = 0;
				lineCycles = 0;
				LCDstate = 2;
				if (IORAM[0x44] == IORAM[0x45]) handleScanCoin();
			} else {
			}
			IORAM[0x0F] &= 0xFD
		}
		IORAM[b] = a;
	}

	IOWriteFunctions[0x44] = function(a, b){
		console.log("writing to LCDY??? what are you even doing")
		//IORAM[b] = 0;
	}

	IOWriteFunctions[0x45] = function(a, b){
		if ((IORAM[b] != a) && (IORAM[0x40]&0x80)) {
			if (IORAM[0x44] == a) handleScanCoin();
		}
		IORAM[b] = a;
	}

	IOWriteFunctions[0x41] = function(a, b){
		IORAM[b] = (IORAM[b]&0x7)|(a&0x78)
	}

	IOReadFunctions[0x41] = function(a){
		return (IORAM[a] & 0xFC) | (IORAM[0x40]&0x80)?LCDstate:0;
	}

	//CGB IO

	IOWriteFunctions[0x4D] = function(a, b){
		IORAM[b] = a;
	};

	IOReadFunctions[0x4D] = function(a) {
		if (CGB) { return (IORAM[a]&1)|((CPUSpeed==2)?0x80:0) }
		else return IORAM[a]
	}

	/* CGB DMA positions */
	IOWriteFunctions[0x51] = function(a) {
		CGBDMA.srcPos = ((a<<8)|(CGBDMA.srcPos&0xFF))&0xFFF0
	}
	IOWriteFunctions[0x52] = function(a) {
		CGBDMA.srcPos = ((a)|(CGBDMA.srcPos&0xFF00))&0xFFF0
	}
	IOWriteFunctions[0x53] = function(a) {
		CGBDMA.destPos = ((a<<8)|(CGBDMA.destPos&0xFF))&0x1FF0
	}
	IOWriteFunctions[0x54] = function(a) {
		CGBDMA.destPos = ((a)|(CGBDMA.destPos&0xFF00))&0x1FF0
	}

	IOReadFunctions[0x51] = function(a) {
		return CGBDMA.srcPos>>8;
	}
	IOReadFunctions[0x52] = function(a) {
		return CGBDMA.srcPos&0xFF;
	}
	IOReadFunctions[0x53] = function(a) {
		return CGBDMA.destPos>>8;
	}
	IOReadFunctions[0x54] = function(a) {
		return CGBDMA.destPos&0xFF;
	}


	IOWriteFunctions[0x55] = function(a, b){ //VRAM DMA
		if (CGB) {
			if (CGBDMA.active && CGBDMA.mode && (!(a&0x80))) {
				CGBDMA.active = false;
				return;
			}
			CGBDMA.active = true;
			//CGBDMA.srcPos = (IORAM[0x52]+(IORAM[0x51]<<8))&0xFFF0
			//CGBDMA.destPos = (IORAM[0x54]+(IORAM[0x53]<<8))&0x1FF0
			CGBDMA.mode = a&0x80;
			CGBDMA.Tlength = ((a&0x7F)+1)<<4;
			IORAM[b] = a;
		} else {
			IORAM[b] = a;
		}
	};

	IOReadFunctions[0x55] = function(a) {
		if (CGB) {
			if (CGBDMA.active) return ((CGBDMA.Tlength>>4)-1)|0x80;
			else return 0;
		} else {
			return IORAM[a];
		}
	}


	IOWriteFunctions[0x4F] = function(a, b){
		if (CGB) {
			IORAM[b] = (a&1);
		} else {
			IORAM[b] = a;
		}
	}

	IOWriteFunctions[0x70] = function(a, b){
		if (CGB) {
			if ((a&7)==0) IORAM[b] = 1;
			else IORAM[b] = (a&7);
		} else {
			IORAM[b] = a;
		}
	}

	IOReadFunctions[0x69] = function(a){
		if (CGB) return CGBBGPalReg[IORAM[0x68]&0x3F]
		else return IORAM[a];
	}

	IOWriteFunctions[0x69] = function(a, b){
		if (CGB) {
			var palette = IORAM[0x68]&0x3F
			CGBBGPalReg[palette] = a;
			var colNum = Math.floor(palette/2)
			var mult = 8.225806451612904;
			CGBBGPal.set([Math.round((CGBBGPalReg[colNum*2]&0x1F)*mult), Math.round(((CGBBGPalReg[colNum*2]>>5)+((CGBBGPalReg[colNum*2+1]&3)<<3))*mult), Math.round(((CGBBGPalReg[colNum*2+1]&0x7C)>>2)*mult), 255], colNum*4);
			if (IORAM[0x68]&0x80) {
				IORAM[0x68] = ((IORAM[0x68]+1)&0x3F)|0x80
			}
		} else {
			IORAM[b] = a;
		}
	}

	IOReadFunctions[0x6B] = function(a){
		if (CGB) return CGBSprPalReg[IORAM[0x6A]&0x3F]
		else return IORAM[a];
	}

	IOWriteFunctions[0x6B] = function(a, b){
		if (CGB) {
			var palette = IORAM[0x6A]&0x3F
			CGBSprPalReg[palette] = a;
			var colNum = Math.floor(palette/2)
			var mult = 8.225806451612904; 
			CGBSprPal.set([Math.round((CGBSprPalReg[colNum*2]&0x1F)*mult), Math.round(((CGBSprPalReg[colNum*2]>>5)+((CGBSprPalReg[colNum*2+1]&3)<<3))*mult), Math.round(((CGBSprPalReg[colNum*2+1]&0x7C)>>2)*mult), 255], colNum*4)
			if (IORAM[0x6A]&0x80) {
				IORAM[0x6A] = ((IORAM[0x6A]+1)&0x3F)|0x80
			}
		} else {
			IORAM[b] = a;
		}
	}

	//END CGB IO

	IOWriteFunctions[0x50] = function(a, b){
		biosActive = false;
		IORAM[b] = a;
	};

	IOWriteFunctions[0x46] = function(a, b){
		DMATransfer(a);
	};
	IOWriteFunctions[0] = function(a, b){
		a = 255 - a
		if(a&0x10) {
			IORAM[0] = buttonByte&0xF;
		} else if(a&0x20) {
			IORAM[0] = buttonByte>>4;
		}
	};

	IOWriteFunctions[0x10] = function(a, b) { if (IORAM[0x26]&0x80) { IORAM[b] = a; } }

	IOWriteFunctions[0x11] = function(a, b) {
		if (IORAM[0x26]&0x80) {
			IORAM[b] = a;
			AudioEngine[0].duty = duties[a>>6]
		} else {
			if (CGB) return;
		}
		AudioEngine[0].lengthCtr = (64-(a&0x3F)); // can be written while off on DMG for whatever reason
	}

	IOWriteFunctions[0x12] = function(a, b) { 
		if (IORAM[0x26]&0x80) { 

			//ZOMBIE MODE
			var attr = IORAM[esweepPtrs[0]];
			if (IORAM[0x26]&(1<<0)) {
				var period = attr&7
				
			}

			IORAM[b] = a; 
			if (!(a&0xF8)) channelOff(0); //DAC Power Off
			soundPhase = 1;


		} 
	}

	IOWriteFunctions[0x13] = function(a, b) {
		if (IORAM[0x26]&0x80) {
			IORAM[b] = a;
			setChannelFrequency(0);
		}
	}

	IOWriteFunctions[0x14] = function(a, b) {
		if (IORAM[0x26]&0x80) {
			var enabledLength = (!(IORAM[0x14]&64) && (a&64))
			if (enabledLength && ((soundPhase&1) == 1) && (AudioEngine[0].lengthCtr != 0)) {
				if (--AudioEngine[0].lengthCtr == 0) {
					channelOff(0);
				}
			}
			IORAM[b] = a;

			if ((a>>7) == 1) triggerChannel(0);
			else setChannelFrequency(0);
			
		}
	}

	IOWriteFunctions[0x15] = function(a, b) { if (IORAM[0x26]&0x80) { IORAM[b] = a; } }

	IOWriteFunctions[0x16] = function(a, b) {
		if (IORAM[0x26]&0x80) {
			IORAM[b] = a;
			AudioEngine[1].duty = duties[a>>6]	
		} else {
			if (CGB) return;
		}
		AudioEngine[1].lengthCtr = (64-(a&0x3F));
	}

	IOWriteFunctions[0x17] = function(a, b) { 
		if (IORAM[0x26]&0x80) { 

			//ZOMBIE MODE
			var attr = IORAM[esweepPtrs[1]];
			if (IORAM[0x26]&(1<<1)) {
				var period = attr&7
				
			}

			IORAM[b] = a; 
			if (!(a&0xF8)) channelOff(1); //DAC Power Off
		} 
	}

	IOWriteFunctions[0x18] = function(a, b) {
		if (IORAM[0x26]&0x80) {
			IORAM[b] = a;
			setChannelFrequency(1);
		}
	}

	IOWriteFunctions[0x19] = function(a, b) {
		if (IORAM[0x26]&0x80) {
			var enabledLength = (!(IORAM[0x19]&64) && (a&64));
			if (enabledLength && ((soundPhase&1) == 1) && (AudioEngine[1].lengthCtr != 0)) {
				if (--AudioEngine[1].lengthCtr == 0) {
					channelOff(1);
				}
			}
			IORAM[b] = a;
			if ((a>>7) == 1) triggerChannel(1);
			else setChannelFrequency(1);
		}
	}

	IOWriteFunctions[0x1A] = function(a, b) { 
		if (IORAM[0x26]&0x80) { 
			IORAM[b] = a; 
			if (!(a&0x80)) channelOff(2);
		} 
	}
	IOWriteFunctions[0x1B] = function(a, b) { 
		if (IORAM[0x26]&0x80) { 
			IORAM[b] = a; 
		} else {
			if (CGB) return;
		}
		AudioEngine[2].lengthCtr = (256-a);
	}
	IOWriteFunctions[0x1C] = function(a, b) { 
		if (IORAM[0x26]&0x80) { 
			IORAM[b] = a; 
			readAndUpdateVolume(2);
		} 
	}

	IOWriteFunctions[0x1D] = function(a, b) {
		if (IORAM[0x26]&0x80) {
			IORAM[b] = a;
			setChannelFrequency(2);
		}
	}

	IOWriteFunctions[0x1E] = function(a, b) {
		if (IORAM[0x26]&0x80) {
			var enabledLength = (!(IORAM[0x1E]&64) && (a&64));
			if (enabledLength && ((soundPhase&1) == 1) && (AudioEngine[2].lengthCtr != 0)) {
				if (--AudioEngine[2].lengthCtr == 0) {
					channelOff(2);
				}
			}
			IORAM[b] = a;
			if ((a>>7) == 1) triggerChannel(2);
			else setChannelFrequency(2);
		}
	}

	IOWriteFunctions[0x1F] = function(a, b) { if (IORAM[0x26]&0x80) { IORAM[b] = a; } }

	IOWriteFunctions[0x20] = function(a, b) { 
		if (IORAM[0x26]&0x80) { 
			IORAM[b] = a; 
		} else {
			if (CGB) return;
		}
		AudioEngine[3].lengthCtr = (64-(a&0x3F));
	}
	IOWriteFunctions[0x21] = function(a, b) { 
		if (IORAM[0x26]&0x80) { 

			//ZOMBIE MODE
			var attr = IORAM[esweepPtrs[3]];
			if (IORAM[0x26]&(1<<3)) {
				var period = attr&7
				
			}

			IORAM[b] = a; 
			if (!(a&0xF8)) channelOff(3); //DAC Power Off
		} 
	}

	IOWriteFunctions[0x22] = function(a, b) {
		if (IORAM[0x26]&0x80) {
			IORAM[b] = a;
			updateNoiseFrequency();
		}
	}

	IOWriteFunctions[0x23] = function(a, b) {
		if (IORAM[0x26]&0x80) {
			var enabledLength = (!(IORAM[0x23]&64) && (a&64));
			if (enabledLength && ((soundPhase&1) == 1) && (AudioEngine[3].lengthCtr != 0)) {
				if (--AudioEngine[3].lengthCtr == 0) {
					channelOff(3);
				}
			}
			IORAM[b] = a;
			if ((a>>7) == 1) triggerChannel(3);
			else updateNoiseFrequency();
		}
	}

	IOWriteFunctions[0x24] = function(a, b) {
		if (IORAM[0x26]&0x80) {
			IORAM[b] = a;
			soundMasterGain();
		}
	}

	IOWriteFunctions[0x25] = function(a, b) {
		if (IORAM[0x26]&0x80) {
			IORAM[b] = a;
			for (var i=0; i<4; i++) {
				AudioEngine[i].lEnable = a&(1<<(i+4))
				AudioEngine[i].rEnable = a&(1<<i)
			}
			//soundMasterGain();
		}
	}

	IOWriteFunctions[0x26] = function(a, b) {
		if ((IORAM[0x26]&0x80) && (!(a&0x80))) {
			//power off!!!
			for (var i=0; i<4; i++) channelOff(i);
			for (var i=0x10; i<0x26; i++) {
				if ((lengthPtrs.indexOf(i) == -1) || CGB) IOWriteFunctions[i](0, i);
			}
			IORAM[b] = 0;
		} else if ((!(IORAM[0x26]&0x80)) && (a&0x80)) {
			IORAM[b] = 0x80;
		}
	}

	IOReadFunctions[0x10] = function(a) { return IORAM[a] | 0x80; }
	IOReadFunctions[0x11] = function(a) { return IORAM[a] | 0x3F; }
	IOReadFunctions[0x13] = function(a) { return IORAM[a] | 0xFF; }
	IOReadFunctions[0x14] = function(a) { return IORAM[a] | 0xBF; }
	IOReadFunctions[0x15] = function(a) { return IORAM[a] | 0xFF; }
	IOReadFunctions[0x16] = function(a) { return IORAM[a] | 0x3F; }
	IOReadFunctions[0x18] = function(a) { return IORAM[a] | 0xFF; }
	IOReadFunctions[0x19] = function(a) { return IORAM[a] | 0xBF; }
	IOReadFunctions[0x1A] = function(a) { return IORAM[a] | 0x7F; }
	IOReadFunctions[0x1B] = function(a) { return IORAM[a] | 0xFF; }
	IOReadFunctions[0x1C] = function(a) { return IORAM[a] | 0x9F; }
	IOReadFunctions[0x1D] = function(a) { return IORAM[a] | 0xFF; }
	IOReadFunctions[0x1E] = function(a) { return IORAM[a] | 0xBF; }
	IOReadFunctions[0x1F] = function(a) { return IORAM[a] | 0xFF; }
	IOReadFunctions[0x20] = function(a) { return IORAM[a] | 0xFF; }
	IOReadFunctions[0x23] = function(a) { return IORAM[a] | 0xBF; }
	IOReadFunctions[0x26] = function(a) { return IORAM[a] | 0x70; }

	IOWriteFunctions[0x47] = function(a, b) { 
		IORAM[b] = a; 
		palettes.set(readDMGPalette(0), 0);
	}
	IOWriteFunctions[0x48] = function(a, b) { 
		IORAM[b] = a; 
		palettes.set(readDMGPalette(1), 16);
	}
	IOWriteFunctions[0x49] = function(a, b) { 
		IORAM[b] = a; 
		palettes.set(readDMGPalette(2), 32);
	}

	function calculateCurrentWaveRam() { //uses last phase and the cycle that phase was on to determine the real Wave RAM Position
		var temp = (AudioEngine[2].phase + AudioEngine[2].frequency*(audioSampleRate/4194304)*(masterClock-WaveRAMCycles))%32
		//console.log((masterClock-WaveRAMCycles)+ " " +(temp-AudioEngine[2].phase))
		return Math.floor(temp/2);
	}

	function WaveRAMRead(a) {
		if (!(IORAM[0x26]&4)) {
			return IORAM[a]
		} else if (true) { //DMG only, CGB is always accessable ---- masterClock-WaveRAMCycles <= 16 ---- currently disabled until accurate Wave RAM Read timings are achieved
			return IORAM[0x30+calculateCurrentWaveRam()]
		} else {
			return 0xFF;
		}
	}
	function WaveRAMWrite(a, b) {
		if (!(IORAM[0x26]&4)) {
			IORAM[b] = a;
		} else if (true) { //DMG only, CGB is always accessable
			console.log("illegal WRAM change!")
			IORAM[0x30+(Math.floor(AudioEngine[2].phase/2))] = a
		}
	}

	for (var i=0x27; i<=0x2F; i++) {
		IOReadFunctions[i] = function(a) { return 0xFF; }
	}

	for (var i=0x30; i<=0x3F; i++) {
		IOReadFunctions[i] = WaveRAMRead
		IOWriteFunctions[i] = WaveRAMWrite
	}

	var IOWriteDefault = function(a, b) {
		IORAM[b] = a;
	}

	var IOReadDefault = function(b) {
		return IORAM[b];
	}

	function DMATransfer(a) {
		var mempos = a<<8;
		for (var i=0; i<0x9F; i++) {
			OAM[i] = MemRead(mempos++);
			/*if (i == 2) { 
				console.log(OAM[2] + " " + (mempos-1));
				console.log(MemRead(55042) + " why");
				Cycles -= 4;
			}*/
			Cycles -= 4;
		}
	}

	// ----- SOUND EMULATION -----

	// ----- WEB AUDIO API BACKEND -----

	function bufferCopyNode(evt) {
		var targ = evt.currentTarget;
		var buf = evt.outputBuffer.getChannelData(0);
		var read = targ.bufferRead;
		buf.set(targ.buffers[read]);
		targ.buffers[read].set(AudioEngine.emptyBuffer);
		if (stereo) {
			var buf = evt.outputBuffer.getChannelData(1);
			buf.set(targ.buffersR[read]);
			targ.buffersR[read].set(AudioEngine.emptyBuffer);
		}
		targ.bufferRead = (read+1)%AudioEngine.buffers

		//if (targ.bufferWrite == read) targ.bufferWrite = targ.bufferRead
		if (!GBObj.paused) audioSyncFrames += (bufferSize/audioSampleRate)/(70224/4194304) //lots of bs values
	}

	function noiseNode(channel) {
		var targ = AudioEngine[channel];
		var LFSR = targ.LFSR;
		if (targ.lEnable || targ.rEnable) {
			handleStereo(((1-(LFSR&1))-0.5)*targ.volume, targ);
		}
		targ.phase++
		while (targ.phase>targ.frequency) {
			var XOR = (LFSR&1)^((LFSR>>1)&1);
			LFSR = (XOR<<14)+(LFSR>>1)
			targ.phase -= targ.frequency;
		}
		targ.LFSR = LFSR;
	}

	function squareWaveNode(channel) {
		var targ = AudioEngine[channel];
		if (targ.lEnable || targ.rEnable) {
			if (targ.phase < targ.frequency*targ.duty) handleStereo(targ.volume/2, targ);
			else handleStereo(0-targ.volume/2, targ);
		}
		targ.phase = (targ.phase+1) % targ.frequency
	}

	function waveNode(channel) {
		var targ = AudioEngine[channel];
		if (targ.lEnable || targ.rEnable) {
			var s1 = Math.floor(targ.phase);
			var ss1 = (IORAM[0x30+Math.floor(s1/2)]>>(4*(1-(s1%2))))&0xF
			handleStereo(((ss1/15)-0.5)*targ.volume, targ);
		}
		WaveRAMCycles = masterClock;
		targ.phase = (targ.phase + targ.frequency)%32
	}

	function handleStereo(value, chn) {
		var targ = AudioEngine.out;
		var pos = targ.bufferPos;
		if (stereo) {
			targ.curBuf[pos] += chn.lEnable?(value*AudioEngine.lVolume):0;
			targ.curBufR[pos] += chn.rEnable?(value*AudioEngine.rVolume):0;
		} else {
			targ.curBuf[pos] += value*AudioEngine.avgVol;
		}
	}

	function advanceBufWrite(targ) {
		targ.bufferPos = 0;
		var cbuf = targ.bufferWrite
		targ.buffers[cbuf].set(targ.curBuf);
		targ.curBuf.set(AudioEngine.emptyBuffer);
		if (stereo) {
			targ.buffersR[cbuf].set(targ.curBufR);
			targ.curBufR.set(AudioEngine.emptyBuffer);
		}
		targ.bufferWrite = (targ.bufferWrite+1)%AudioEngine.buffers
		if (targ.bufferWrite == targ.bufferRead) targ.bufferWrite = cbuf
	}

	function checkDACPower(channel) {
		switch (channel) {
			case 0:
				return IORAM[0x12]&0xF8;
			case 1:
				return IORAM[0x17]&0xF8;
			case 2:
				return IORAM[0x1A]&0x80;
			case 3:
				return IORAM[0x21]&0xF8;
		}
	}

	function prepareAudioEngine() {
		var initRequired = (typeof AudioEngine == "undefined") 

		if (initRequired) {
			AudioEngine = []
			sampleNumber = 0;
			audioSampleRate = GBAudioContext.sampleRate; //not accurate but works for now
			bufferSize = 1024;
			while (bufferSize/audioSampleRate < 0.016) {
				bufferSize *= 2;
			}
		}

		GBAudioContext.createScriptProcessor = GBAudioContext.createScriptProcessor || GBAudioContext.createJavaScriptNode
		var buffers = 4;
		AudioEngine.buffers = buffers; // immediate audio is not possible without clicks since audio is at a diff frequency

		if (initRequired) { 
			//if (!(NoAudioAPI)) AudioEngine.out = new iosSucksProcessorNode(GBAudioContext, bufferSize, 1);
			//else 
			AudioEngine.out = GBAudioContext.createScriptProcessor(bufferSize, 0, stereo?2:1);
			AudioEngine.out.connect(GBAudioContext.destination);
		}

		AudioEngine.out.buffers = new Array(buffers);
		if (stereo) AudioEngine.out.buffersR = new Array(buffers);
		for (var j=0; j<buffers; j++) {
			AudioEngine.out.buffers[j] = new Float32Array(bufferSize);
			if (stereo) AudioEngine.out.buffersR[j] = new Float32Array(bufferSize);
		}
		AudioEngine.out.curBuf = new Float32Array(bufferSize);
		if (stereo) AudioEngine.out.curBufR = new Float32Array(bufferSize);
		AudioEngine.out.bufferPos = 0;
		AudioEngine.out.bufferRead = 0;
		AudioEngine.out.bufferWrite = buffers-1;
		AudioEngine.out.onaudioprocess = bufferCopyNode;

		for (var i=0; i<4; i++) {
			AudioEngine[i] = {};
			AudioEngine[i].lEnable = false;
			AudioEngine[i].rEnable = false;
			AudioEngine[i].frequency = 0;
			AudioEngine[i].duty = 0.5;
			AudioEngine[i].phase = 0;
			AudioEngine[i].volume = 0;
			AudioEngine[i].sampleNumber = 0;
			AudioEngine[i].lengthCtr = 0;
		}

		AudioEngine[3].LFSR = 32767;
		AudioEngine[3].frequency = 4194304/8;

		AudioEngine.emptyBuffer = new Float32Array(bufferSize);
		AudioEngine.lVolume = 0;
		AudioEngine.rVolume = 0;
		AudioEngine.avgVol = 0;
	}

	// ----- END WEB AUDIO API BACKEND -----

	var duties = [0.125, 0.25, 0.5, 0.75]
	var freqDivisors = [1/2, 1, 2, 3, 4, 5, 6, 7]
	var esweepPtrs = [0x12, 0x17, 0, 0x21]

	function handleLengths() {

		clockLength(0);
		clockLength(1);
		clockLength(2);
		clockLength(3);

	}

	function clockLength(channel) {
		if ((IORAM[lengthPtrs[channel]])&64) {
			if (--AudioEngine[channel].lengthCtr == 0) {
				channelOff(channel);
			}
		}
	}

	function handleSweep() {
		//if (IORAM[0x26]&1) {
			if (AudioEngine[0].fSweepEnabled) {
				var period = (IORAM[0x10]>>4)&0x7
				if (period > 0) {
					if (--AudioEngine[0].fsweep <= 0) {
						AudioEngine[0].fsweep = period;
						calculateSweep(true);
						calculateSweep(false);
					} 
				} else {
					if (--AudioEngine[0].fsweep <= 0) {
						AudioEngine[0].fsweep = 8;
					}
				}
			}
		//}
	}

	function calculateSweep(writeback) {
		var shift = IORAM[0x10]&7
		if (!(writeback)) var temp = AudioEngine[0].freqreg;
		var cfreq = AudioEngine[0].freqreg>>shift;

		AudioEngine[0].freqreg += (IORAM[0x10]&8)?-cfreq:cfreq;

		if (AudioEngine[0].freqreg < 0) AudioEngine[0].freqreg = 0;
		if (AudioEngine[0].freqreg > 0x7FF) {
			AudioEngine[0].freqreg = 0x7FF;
			channelOff(0);
		}

		if (writeback) {
			AudioEngine[0].frequency = audioSampleRate/(524288/((2048-AudioEngine[0].freqreg)*4));
			IORAM[0x13] = AudioEngine[0].freqreg&0xFF;
			IORAM[0x14] &= 0xF8;
			IORAM[0x14] |= AudioEngine[0].freqreg>>8;
		} else { AudioEngine[0].freqreg = temp; }
	}

	function envelopeTick(chan) {
		if (IORAM[0x26]&(1<<chan)) {
			var attr = IORAM[esweepPtrs[chan]];
			var period = attr&7
			if (period > 0) {
				if (--AudioEngine[chan].esweep <= 0) {
					AudioEngine[chan].esweep = period;
					var volume = AudioEngine[chan].volreg;
					if (attr&8) {
						volume++;
					} else {
						volume--;
					}
					if (volume < 0) volume = 0;
					if (volume > 15) volume = 15;

					AudioEngine[chan].volreg = volume;
					setVolumeChannel(chan, volume/15)

				}
			} else {
				if (--AudioEngine[chan].esweep <= 0) {
					AudioEngine[chan].esweep = 8;
				}
			}

		}
	}

	function handleEnvelope() {
		envelopeTick(0);
		envelopeTick(1);
		envelopeTick(3);
	}

	function updateNoiseFrequency() {
		AudioEngine[3].frequency = audioSampleRate/(((4194304/8)/freqDivisors[IORAM[0x22]&0x7])>>((IORAM[0x22]>>4)+1))
	}

	function soundMasterGain() {
		if ((IORAM[0x26]>>7) == 1) {
			AudioEngine.lVolume=((IORAM[0x24]>>4)&7)/7
			AudioEngine.rVolume=(IORAM[0x24]&7)/7
			AudioEngine.avgVol=(AudioEngine.lVolume+AudioEngine.rVolume)/2
		} else {
			AudioEngine.lVolume=0
			AudioEngine.rVolume=0
			AudioEngine.avgVol=0
		}
	}

	function setVolumeChannel(channel, volume) {
		if (IORAM[0x26]&(1<<channel)) AudioEngine[channel].volume = volume/4; //if activated, set the volume. divide by 4 to avoid any clipping
		else AudioEngine[channel].volume = 0;
	}

	var lengthPtrs = [0x14, 0x19, 0x1E, 0x23]

	function triggerChannel(channel) { //todo: simplify.
		if (false) { //DISABLED until accurate timings are achieved 
			if ((channel == 2) && (IORAM[0x26]&4)) { //special dmg behaviour corrupts wave ram while on
				var temp = Math.floor(AudioEngine[2].phase/2);
				if (temp > 3) { //corrupt first 3 bytes
					temp = Math.floor(temp/4)*4 //align with 4 byte section
					IORAM[0x30] = IORAM[0x30+(temp++)]
					IORAM[0x31] = IORAM[0x30+(temp++)]
					IORAM[0x32] = IORAM[0x30+(temp++)]
					IORAM[0x33] = IORAM[0x30+(temp++)] //write first 4 bytes with bytes aligned to current position
				} else { //only corrupt first byte
					IORAM[0x30] = IORAM[0x30+temp] //first byte = current read byte
				}
			}
		}

		if (channel < 3) {
			setChannelFrequency(channel);
			AudioEngine[channel].phase = 0;
		} else {
			AudioEngine[channel].LFSR = 32767;
		}

		if (checkDACPower(channel)) IORAM[0x26] |= 1<<channel;
		readAndUpdateVolume(channel);
		var unfrozen
		if (AudioEngine[channel].lengthCtr == 0) {
			if (channel == 2) AudioEngine[channel].lengthCtr = 256;
			else AudioEngine[channel].lengthCtr = 64;
			if ((IORAM[lengthPtrs[channel]]&64) && ((soundPhase&1) == 1)) AudioEngine[channel].lengthCtr -= 1;
		}

		AudioEngine[channel].esweep = 0;

		if (channel == 0) { 
			var period = (IORAM[0x10]>>4)&0x7
			var shift = IORAM[0x10]&7
			AudioEngine[0].fsweep = (period==0)?8:period;
			AudioEngine[0].fSweepEnabled = (period+shift > 0);
			AudioEngine[0].freqreg = IORAM[0x13]+((IORAM[0x14]&7)<<8); 
			if (IORAM[0x10]&7) { calculateSweep(false); } //i don't think this affects frequency, just checks
		}

		return unfrozen;
	}

	function channelOff(channel) {
		IORAM[0x26] &= 255-(1<<channel);
		setVolumeChannel(channel, 0);
	}

	function readAndUpdateVolume(channel) {
		switch (channel) {
			case 0: 
				var volume = (IORAM[0x12]>>4)/15
				break;
			case 1: 
				var volume = (IORAM[0x17]>>4)/15
				break;
			case 2: 
				switch ((IORAM[0x1C]>>5)&3) {
					case 0: 
						var volume = 0;
						break;
					case 1:
						var volume = 1;
						break;
					case 2:
						var volume = 0.5;
						break;
					case 3:
						var volume = 0.25;
						break;
				}
				break;
			case 3: 
				var volume = (IORAM[0x21]>>4)/15
				break;
		}
		AudioEngine[channel].volreg = Math.round(volume*15);
		setVolumeChannel(channel, volume);
	}

	function setChannelFrequency(channel) {
		switch (channel) {
			case 0: 
				var frequency = IORAM[0x13]+((IORAM[0x14]&7)<<8)
				AudioEngine[channel].frequency = audioSampleRate/(524288/((2048-frequency)*4));
				break;
			case 1: 
				var frequency = IORAM[0x18]+((IORAM[0x19]&7)<<8)
				AudioEngine[channel].frequency = audioSampleRate/(524288/((2048-frequency)*4));
				break;
			case 2: 
				var frequency = IORAM[0x1D]+((IORAM[0x1E]&7)<<8)
				AudioEngine[channel].frequency = (4194304/((2048-frequency)*2))/audioSampleRate;
				break;
		}

	}

	// ----- GPU EMULATION -----

	function readDMGPalette(num) {
		var bgpal = IORAM[0x47+num];
		return colours[bgpal&3].concat(colours[(bgpal>>2)&3], colours[(bgpal>>4)&3], colours[(bgpal>>6)&3]);
	}

	function drawScanline(num) { //horribly unoptimised drawing code
		var lcdcont = IORAM[0x40];

		if (lcdcont & 0x80) {
		tileLayerData.set(emptyTileLayer);
		if (CGB) tileLayerPalette.set(emptyTileLayer);
		var hisprites = [];

		if ((lcdcont & 0x1) || CGB) {
			var xpos = IORAM[0x43];
			var xfine = 7-(xpos%8)
			var xtile = (xpos>>3)%32
			if (xtile < 0) xtile += 32;
			var ypos = (num+IORAM[0x42])&0xFF;
			var yfine = (ypos%8)*2
			var ytileo = (ypos>>3)*32

			var bgmaploc = (0x1800+((lcdcont>>3)&0x1)*1024)+ytileo;
			var tileLocation = 0x1000-((lcdcont>>4)&0x1)*0x1000;

			if (CGB) {
				var attributes = VRAM[bgmaploc+xtile+0x2000]
				var palnum = attributes&7
				var yflip = (attributes&0x40)
				var xfineDir = (attributes&0x20)?1:-1
				if (xfineDir == 1) xfine = 7-xfine
			} else {
				var yflip=false
				xfineDir = -1;
			}
			var currentTile = VRAM[bgmaploc+xtile]
			if ((!(lcdcont&0x10))&&currentTile>127) currentTile -= 256;
			var tileOffset = tileLocation+currentTile*16+(yflip?14-yfine:yfine)
			if (CGB) { if (attributes&8) tileOffset += 0x2000; }

			var tile1 = VRAM[tileOffset]
			var tile2 = VRAM[tileOffset+1]
			
			var pnum
			for (i=0; i<160; i++) {
				pnum = ((tile1>>xfine)&1)+(((tile2>>xfine)&1)<<1);
				tileLayerData[i] = pnum;
				if (CGB) tileLayerPalette[i] = palnum|(attributes&0x80);
				xfine += xfineDir
				if (xfine&8) {
					xtile = (xtile+1)%32
					currentTile = VRAM[bgmaploc+xtile]
					if (CGB) {
						attributes = VRAM[bgmaploc+xtile+0x2000]
						palnum = attributes&7
						yflip = (attributes&0x40)
						xfineDir = (attributes&0x20)?1:-1
						if (xfineDir == 1) xfine = 0
						else xfine = 7
					} else {
						xfine = 7;
					}
					if ((!(lcdcont&0x10))&&currentTile>127) currentTile -= 256;
					tileOffset = tileLocation+currentTile*16+(yflip?14-yfine:yfine)
					if (CGB) { if (attributes&8) tileOffset += 0x2000; }
					tile1 = VRAM[tileOffset]
					tile2 = VRAM[tileOffset+1]
				}
			}
		} else {
			for (i=0; i<160; i++) {
				tileLayerData[i] = 0;
				if (CGB) tileLayerPalette[i] = 0;
			}
		}

		if (lcdcont & 0x20) { //window
			var ypos = (num-IORAM[0x4A]);
			if ((ypos >= 0) && (ypos < 144)) {
			var xpos = 7-IORAM[0x4B];
			var xfine = 7-(xpos&7)
			var xtile = Math.floor(xpos/8);
			var yfine = (ypos%8)*2
			var ytileo = (ypos>>3)*32

			var bgmaploc = (0x1800+((lcdcont>>6)&0x1)*1024)+ytileo;
			var tileLocation = 0x1000-((lcdcont>>4)&0x1)*0x1000;

			var currentTile = VRAM[bgmaploc+xtile]
			if ((!(lcdcont&0x10))&&currentTile>127) currentTile -= 256;
			var tileOffset = tileLocation+currentTile*16+yfine
			if (CGB) {
				var attributes = VRAM[bgmaploc+xtile+0x2000]
				var palnum = attributes&7
				if (attributes&8) tileOffset += 0x2000;
			}
			var tile1 = VRAM[tileOffset]
			var tile2 = VRAM[tileOffset+1]

			var pnum
			for (i=0; i<160; i++) {
				pnum = ((tile1>>xfine)&1)+(((tile2>>xfine)&1)<<1);
				if ((xtile>-1) && (xtile < 21)) {
					tileLayerData[i] = pnum;
					if (CGB) tileLayerPalette[i] = palnum|(attributes&0x80);
				}
				if (--xfine < 0) {
					xfine = 7;
					xtile = (xtile+1)
					currentTile = VRAM[bgmaploc+xtile]
					if ((!(lcdcont&0x10))&&currentTile>127) currentTile -= 256;
					tileOffset = tileLocation+currentTile*16+yfine
					if (CGB) {
						var attributes = VRAM[bgmaploc+xtile+0x2000]
						var palnum = attributes&7
						if (attributes&8) tileOffset += 0x2000;
					}
					tile1 = VRAM[tileOffset]
					tile2 = VRAM[tileOffset+1]
				}
			}
			}
		}

		var bitmapPos = num*160
		var pnum
		var palette = CGB?CGBInt32BG:palettesInt32;
		for (var i=0; i<160; i++) {
			pnum = tileLayerData[i];
			if ((pnum != 0) || (GBScreenInt32[bitmapPos] == 0)) {
				if (CGB) pnum += (tileLayerPalette[i]&7)*4
				GBScreenInt32[bitmapPos++] = palette[pnum]
			} else {
				bitmapPos++;
			}
		}

		if (lcdcont & 0x2) {
			//cgb ordering
			var sprOff = 39*4;
			for (var i=0; i<40; i++) { //draw sprites
				drawSprite(sprOff, num, palettesInt32);
				sprOff -= 4;
			}
		}

		} else {
			var bitmapPos = (num*160)*4
			if (CGB) var r=255, g=255, b=255;
			else var r=colours[0][0], g=colours[0][1], b=colours[0][2];
			for (var i=0; i<160; i++) {
				GBScreen.data[bitmapPos++] = r
				GBScreen.data[bitmapPos++] = g
				GBScreen.data[bitmapPos++] = b
				GBScreen.data[bitmapPos++] = 255;
			}
		}
	}

	function drawSprite(sprOff, num, palettes) {
		var inc
		var yfine = num-(OAM[sprOff]-16)
		var bitmapPos = num*160
		var behind = OAM[sprOff+3]&0x80
		var doubleHt = (IORAM[0x40]&0x4);
		if ((yfine >= 0) && ((doubleHt?16:8) > yfine)) {
			var sprFlags = OAM[sprOff+3]
			if (CGB) {
				var palettes = CGBInt32Spr
				var pnumoff = (sprFlags&7)*4
			} else {
				var pnumoff = (((sprFlags&0x10)>>4)+1)*4;
			}
			if (sprFlags&0x40) yfine = (doubleHt?15:7)-yfine;
			var sprTile = OAM[sprOff+2];
			if (doubleHt) sprTile &= 0xFFFE;
			var tileOffset = sprTile*16+yfine*2
			var xfine = 0;
			if (!(sprFlags&0x20)) { var xdraw = OAM[sprOff+1]-1; inc=-1; }
			else { var xdraw = OAM[sprOff+1]-8; inc=1; }
			var currentBit = bitmapPos+xdraw
			if (CGB && (sprFlags&8)) tileOffset += 0x2000;
			var tile1 = VRAM[tileOffset]
			var tile2 = VRAM[tileOffset+1]
			var pnum
			while (xfine < 8) {
				if (xdraw>=0 && xdraw<160) {
					pnum = (((tile1>>xfine)&1)+(((tile2>>xfine)&1)<<1));
					if ((pnum != 0) && (!((tileLayerPalette[xdraw]&0x80) || behind) || (tileLayerData[xdraw] == 0))) {
						pnum += pnumoff;
						GBScreenInt32[currentBit] = palettes[pnum];
					}
				}
				xdraw += inc
				currentBit += inc
				xfine++;
			}
		}
	}

	function prepareGBScreen() {
		GBScreen.data.set(EmptyImageBuffer);
	}

	// ----- CARTRIDGE HARDWARE (MBC etc) EMULATION -----

	var MBCTable = [
		{type: 0, hardware: []},
		{type: 1, hardware: [], RAMBankMode:false},
		{type: 1, hardware: ["RAM"], RAMBankMode:false},
		{type: 1, hardware: ["RAM", "BATTERY"], RAMBankMode:false},
		null,
		{type: 2, hardware: []},
		{type: 2, hardware: ["BATTERY"]},
		null,
		{type: 0, hardware: ["RAM"]},
		{type: 0, hardware: ["RAM", "BATTERY"]},
		null,
		{type: 6, hardware: []},//MMM01
		{type: 6, hardware: ["RAM"]}, 
		{type: 6, hardware: ["RAM", "BATTERY"]}, 
		null,
		{type: 3, hardware: ["TIMER", "BATTERY"]}, 
		{type: 3, hardware: ["TIMER", "RAM", "BATTERY"]}, 
		{type: 3, hardware: []}, 
		{type: 3, hardware: ["RAM"]},
		{type: 3, hardware: ["RAM", "BATTERY"]},
		null,
		{type: 4, hardware: []}, 
		{type: 4, hardware: ["RAM"]}, 
		{type: 4, hardware: ["RAM", "BATTERY"]},
		null,
		{type: 5, hardware: []}, 
		{type: 5, hardware: ["RAM"]}, 
		{type: 5, hardware: ["RAM", "BATTERY"]}, 
		{type: 5, hardware: ["RUMBLE"]}, 
		{type: 5, hardware: ["RUMBLE", "RAM"]}, 
		{type: 5, hardware: ["RUMBLE", "RAM", "BATTERY"]},  
	]

	var MBCWriteHandlers = []
	var MBCReadHandlers = []
	MBCWriteHandlers[0] = function(w, v) {
		//(do nothing)
	}

	MBCWriteHandlers[1] = function(w, v) {
		if (w < 0x2000) {
			MBC.RAMenable = ((v&0xF) == 0xA);
		} else if (w < 0x4000) {
			if ((v&0x1F) == 0) v = 1;
			MBC.ROMbank = (MBC.ROMbank&0x60) | (v&0x1F)
		} else if (w < 0x6000) {
			if (MBC.RAMBankMode) MBC.RAMbank = (v&3)
			else MBC.ROMbank = (MBC.ROMbank&0x1F) | ((v&3)<<5)
		} else if (w < 0x8000) {
			MBC.RAMBankMode = (v&1)
		} else if ((w < 0xC000) && (w >= 0xA000)) {
			if (MBC.RAMenable) { CRAM[w-0xA000+MBC.RAMbank*0x2000] = v; }
		}
	}

	MBCWriteHandlers[3] = function(w, v){
		if (w < 0x2000) {
			MBC.RAMenable = ((v&0xF) == 0xA);
			if (!(MBC.RAMenable)) MBC.RAMbank = 0;
		} else if (w < 0x4000) {
			MBC.ROMbank = Math.max(v&0x7F, 1);
		} else if (w < 0x6000) {
			if ((v<4) || ((v>7) && (v<0xD))) MBC.RAMbank = v;
		} else if (w < 0x8000) {
			if (MBC.hardware.indexOf("TIMER")>-1) {
				if ((!MBC.RTC.latch) && (v == 1)) {
					updateRTC(true);
				}
				MBC.RTC.latch = (v == 1)
			}
		} else if ((w < 0xC000) && (w >= 0xA000)) {
			if (MBC.RAMenable) {
				if (MBC.RAMbank < 4) CRAM[w-0xA000+MBC.RAMbank*0x2000] = v; //assuming no RTC! again it's unimplemented!!!!
			}
		}
	}

	function updateRTC(useCycles) {
		var d = new Date();
		MBC.RTC.seconds = d.getSeconds();
		MBC.RTC.minutes = d.getMinutes();
		MBC.RTC.hours = (d.getHours()+14)%24;
		MBC.RTC.lowDays = Math.floor(d.getTime()/(1000*60*60*24))&255
		MBC.RTC.hiDays = (Math.floor(d.getTime()/(1000*60*60*24))&256)>>8
		//RTC.seconds += (masterClock - RTC.setCycle)/
	}

	MBCWriteHandlers[5] = function(w, v){
		if (w < 0x2000) {
			MBC.RAMenable = ((v&0xF) == 0xA);
		} else if (w < 0x3000) {
			MBC.ROMbank = (MBC.ROMbank&0x100)|v
		} else if (w < 0x4000) {
			MBC.ROMbank = (MBC.ROMbank&0xFF)|((v&1)<<8)
		} else if (w < 0x6000) {
			MBC.RAMbank = v&0x0F;
		} else if ((w < 0xC000) && (w >= 0xA000)) {
			if (MBC.RAMenable) CRAM[w-0xA000+MBC.RAMbank*0x2000] = v;
		}
	}

	MBCReadHandlers[0] = function(a) {
		if (a < 0x4000) {
			return game[a];
		} else if (a < 0x8000) {
			return game[a];
		} else {
			return 0;
		}
	}

	MBCReadHandlers[1] = function(a) {
		if (a < 0x4000) {
			return game[a];
		} else if (a < 0x8000) {
			return game[(a-0x4000)+MBC.ROMbank*0x4000];
		} else if ((a < 0xC000) && (a >= 0xA000)) {
			if (MBC.RAMenable) return CRAM[a-0xA000+MBC.RAMbank*0x2000];
			else return 0;
		} else {
			return 0;
		}
	}

	MBCReadHandlers[3] = function(a) {
		if (a < 0x4000) {
			return game[a];
		} else if (a < 0x8000) {
			return game[(a-0x4000)+MBC.ROMbank*0x4000];
		} else if ((a < 0xC000) && (a >= 0xA000)) {
			if (MBC.RAMenable) { 
				if (MBC.RAMbank < 4) return CRAM[a-0xA000+MBC.RAMbank*0x2000];
				else if (MBC.RAMbank == 8) return MBC.RTC.seconds;
				else if (MBC.RAMbank == 9) return MBC.RTC.minutes;
				else if (MBC.RAMbank == 10) return MBC.RTC.hours;
				else if (MBC.RAMbank == 11) return MBC.RTC.lowDays;
				else if (MBC.RAMbank == 11) return MBC.RTC.hiDays|(MBC.RTC.active?0:0x40)|(MBC.RTC.dayCarry?0x80:0);
			} else return 0;
		} else {
			return 0;
		}
	}

	MBCReadHandlers[5] = function(a) {
		if (a < 0x4000) {
			return game[a];
		} else if (a < 0x8000) {
			return game[(a-0x4000)+MBC.ROMbank*0x4000];
		} else if ((a < 0xC000) && (a >= 0xA000)) {
			if (MBC.RAMenable) return CRAM[a-0xA000+MBC.RAMbank*0x2000];
			else { return 0; }
		} else {
			return 0;
		}
	}

	//special MBC for GBS files (start at offset)

	MBCWriteHandlers[6] = function(w, v){
		if ((w < 0x4000) && (w >= 0x2000)) {
			MBC.ROMbank = v;
		} else if ((w < 0xC000) && (w >= 0xA000)) {
			CRAM[w-0xA000] = v;
		}
	}

	MBCReadHandlers[6] = function(a) {
		if (a < 0x4000) {
			if (a-MBC.offset < 0) {
				return MBC.lowData[a] | 0;
			} else {
				return game[(a-MBC.offset)+0x70];
			}
		} else if (a < 0x8000) {
			return game[((a-0x4000)+MBC.ROMbank*0x4000-MBC.offset)+0x70];
		} else if ((a < 0xC000) && (a >= 0xA000)) {
			return CRAM[a-0xA000];
		} else {
			return 0;
		}
	}

	function loadBattery() {
		var battery = localStorage["battery/"+ROMID]
		if (MBC.type == 5) CRAM = new Uint8Array(RAMsizesMBC5[Math.min(3, game[0x149])]);
		else CRAM = new Uint8Array(RAMsizes[Math.min(3, game[0x149])]);
		if (typeof battery != "undefined") {
			for (var i=0; i<battery.length; i++) {
				CRAM[i] = battery.charCodeAt(i);
			}
		}
	}

	function saveBattery() {
		if (!MBC) return;
		if (MBC.hardware.indexOf("BATTERY") == -1) return;
		var battery = "";
		for (var i=0; i<CRAM.length; i++) {
			battery += String.fromCharCode(CRAM[i]);
		}
		localStorage["battery/"+ROMID] = battery;
	}

	// ----- CPU EMULATION -----

	function init() {
		if (typeof GBObj.onload == "function") GBObj.onload(GBObj);
		GBObj.onload = null;
		GBObj.ROMname = getROMName();

		if (GBMaster.gameboys.indexOf(GBObj) == -1) {
      if (GBMaster.gameboys.length == 0) GBMaster.gameboys.push(GBObj);
      else GBMaster.gameboys[0] = GBObj;
    }

		GBObj.cycle = cycle; //expose certain functions
		GBObj.frameCycles = 0;
		
		for (var i=0; i<0x80; i++) {
			if (IOReadFunctions[i] == null) IOReadFunctions[i] = IOReadDefault;
			if (IOWriteFunctions[i] == null) IOWriteFunctions[i] = IOWriteDefault;
		}
		ROMID = generateUniqueName();

		CGB = ((game[0x143] == 0x80) || (game[0x143] == 0xC0));
		buttonByte = 255;

		reset(true);
	}

	var RAMsizes = [0, 0x800, 0x2000, 0x8000]
	var RAMsizesMBC5 = [0, 0x2000, 0x8000, 0x20000]
	this.reset = reset;

	function reset(reloadBattery) {

		registerDebug = [];
		instCount = 0;

		prepareAudioEngine(); //have to do this even with no audio api (see above)

		tileLayerPalette.set(emptyTileLayer); //this needs to be init to all zeroes in DMG mode so CGB tile priority from the previously drawn CGB screen doesnt take effect.

		var mbcid = (MBCTable[game[0x147]] != null)?game[0x147]:0;
		MBC = JSON.parse(JSON.stringify(MBCTable[mbcid]));
		GBObj.MBC = MBC; //make MBC public

		if (MBC.hardware.indexOf("RAM") > -1) { 
			MBC.RAMenable = false; 
			MBC.RAMbank = 0;
			if (reloadBattery) {
				if (MBC.hardware.indexOf("BATTERY") > -1) loadBattery();
				else {
					if (MBC.type == 5) CRAM = new Uint8Array(RAMsizesMBC5[Math.min(3, game[0x149])]);
					else CRAM = new Uint8Array(RAMsizes[Math.min(3, game[0x149])]);
				}
			}
			if (MBC.hardware.indexOf("TIMER") > -1) {
				MBC.RTC = {
					latch: false,
					seconds: 0,
					minutes: 0,
					hours: 0,
					lowDays: 0,
					hiDays: 0,
					active: false,
					dayCarry: false,
					setCycle: 0, // used for cycle accurate times
					setTime: 0, // used for resume from battery
				}
			}
		}
		if (MBC.type > 0) { MBC.ROMbank = 1 }
		MBCReadHandler = MBCReadHandlers[MBC.type];
		MBCWriteHandler = MBCWriteHandlers[MBC.type];

		VRAM = new Uint8Array((CGB)?0x4000:0x2000);
		RAM = new Uint8Array((CGB)?0x8000:0x2000);
		OAM = new Uint8Array(0xA0);
		IORAM = new Uint8Array(0x80);
		ZRAM = new Uint8Array(0x80);
		CPUSpeed = 1;

		if (CGB) {
			IORAM[0x70] = 1;
			CGBBGPalReg = new Uint8Array(0x60);
			CGBBGPal = new Uint8Array(128);
			CGBSprPalReg = new Uint8Array(0x60);
			CGBSprPal = new Uint8Array(128);
			CGBInt32BG = new Uint32Array(CGBBGPal.buffer);
			CGBInt32Spr = new Uint32Array(CGBSprPal.buffer);
			var index = 0
			for (var i=0; i<32; i++) {
				CGBBGPal.set([255, 255, 255, 255], i*4);
				CGBSprPal.set([255, 255, 255, 255], i*4);
				CGBSprPalReg[index] = 0xFF;
				CGBBGPalReg[index++] = 0xFF;
				CGBSprPalReg[index] = 0x7F;
				CGBBGPalReg[index++] = 0x7F;
			}
			CGBDMA = {
				active: false,
				mode: 0,
				Tlength: 0,
				srcPos: 0,
				destPos: 0
			}
			biosActive = (CGBbios != null);
		} else {
			CGBDMA = {active: false}
			biosActive = (bios != null);
			if (!biosActive) {
				IORAM[0x70] = 1;
			}
		}

		SP = 0;
		if (biosActive) {
			registers = new Uint8Array([0, 0, 0, 0, 0, 0, 0]) //A, B, C, D, E, H, L
		} else {
			SP = 0xFFFE;
			registers = new Uint8Array([CGB?17:1, 0, 0x13, 0, 0xD8, 0x01, 0x4D]) //A, B, C, D, E, H, L
			IORAM[0x40] = 0x91;
		}
		flags = [0, 0, 0, 0, 1] //Z, N, H, C, true (for non conditional jumps)

		PC = (biosActive)?0:0x100;
		IORAM[0x44] = (biosActive)?0:((CGB)?144:153);
		Cycles = 0;
		LCDstate = (biosActive)?1:2;
		IME = false; //interrupt master enable
		halted = false;
		palettes = new Uint8Array(readDMGPalette(0).concat(readDMGPalette(1), readDMGPalette(2)));
		palettesInt32 = new Uint32Array(palettes.buffer);

		//cyclesAtLastAudio = 0;
		masterClock = 0;
		lineCycles = 0;
		soundCycles = 0;
		soundPhase = 0;
		timerCycles = 0;
		audioCycles = 0;
		cyclesForSample = 4194304/audioSampleRate;
		divCounts = 0;
		//timerCounts = 0;

		audioSyncFrames = 0;

		timeStart = Date.now();
		prepareGBScreen();
		if (typeof GBObj.onstart == "function") GBObj.onstart();
		GBObj.onstart = null;
		//timeBetweenFrames = Date.now();
	}

	this.setButtonByte = function(b) {
		buttonByte = b;
	}

	this.prepareButtonByte = function() { //for default included controls system
		buttonByte = ((keysArray[keyConfig.DOWN])<<3)+((keysArray[keyConfig.UP])<<2)+((keysArray[keyConfig.LEFT])<<1)+((keysArray[keyConfig.RIGHT])<<0)+ ((keysArray[keyConfig.START])<<7)+((keysArray[keyConfig.SELECT])<<6)+((keysArray[keyConfig.B])<<5)+(keysArray[keyConfig.A]<<4);
		
		if (getGamepads) { //gamepad support present!
			//if (navigator.webkitGetGamepads) var gamepads = navigator.webkitGetGamepads();
			//if (navigator.webkitGamepads) var gamepads = navigator.webkitGamepads();
			if (navigator.getGamepads) var gamepads = navigator.getGamepads();
			for (var i=0; i<gamepads.length; i++) {
				if (gamepads[i] != null) {
					var j = gamepads[i];

					//TODO: custom bindings for controllers
          if (!j.buttons[15]) continue;

					if (j.axes[0] > 0.5 || j.buttons[15].pressed) buttonByte ^= 1<<0; //right
					if (j.axes[0] < -0.5 || j.buttons[14].pressed) buttonByte ^= 1<<1; //left
					if (j.axes[1] > 0.5 || j.buttons[13].pressed) buttonByte ^= 1<<3; //down
					if (j.axes[1] < -0.5 || j.buttons[12].pressed) buttonByte ^= 1<<2; //up

					if (j.buttons[9].pressed) buttonByte ^= 1<<7; //start
					if (j.buttons[8].pressed) buttonByte ^= 1<<6; //select
					if (j.buttons[0].pressed) buttonByte ^= 1<<5; //B
					if (j.buttons[1].pressed) buttonByte ^= 1<<4; //A
				}
			}

		}
	}

	this.audioSyncUpdate = function() {
		//document.getElementById("debug").innerHTML = Instructions[MemRead(535)]+"<br><br>"+PrefixCBI[MemRead(536)];
		//Cycles -= 8BI;
		try {
			if (GBObj.paused) return; //don't run!
			if (!GBObj.options.cButByte) GBObj.prepareButtonByte();
			if (NoAudioAPI) audioSyncFrames++;
			frameskip = false;
			var firstFrame = (audioSyncFrames >= 1)
			var frameStart = Date.now();
			while ((firstFrame) || audioSyncFrames >= 2) {
				firstFrame = false;

				while (GBObj.frameCycles<70224) {
					cycle();
				}
				GBObj.frameCycles -= 70224;

				audioSyncFrames--;
				if (Date.now()-frameStart > 16) { 
					audioSyncFrames = 1;
					break; //can't make it back to audio sync, break out of loop before you freeze the gb
				}
				frameskip = true;
			}
		} catch (err) {
			console.error(err.stack);
			errorScreen(err);
		}
	}

	function errorScreen(err) { //display when something goes horribly wrong
		GBObj.paused = true; //stop executing before we cause any more damage

		internalCtx.fillStyle = "#FFFFFF"
		internalCtx.fillRect(0, 0, 160, 144);
		var img = new Image();
		img.src = sadGB;
		img.onload = function() {
			internalCtx.drawImage(img, 68, 51);
			ctx.drawImage(internalCanvas, 0, 0, canvas.width, canvas.height);
			alert("Something went horribly wrong! Here's the stack trace:\n"+err.stack);
		}
	}



	function drawProgress(e) {
		var progressSeg = ["#B90546", "#5255A5", "#79AD36", "#DDB10A", "#009489"]

		internalCtx.fillStyle = "#FFFFFF"
		internalCtx.fillRect(0, 0, 160, 144);

		internalCtx.fillStyle = "#EEEEEE"
		internalCtx.fillRect(30, 71, 100, 2);
		var percent = e.loaded/e.total;

		for (var i=0; i<5; i++) {
			var ext = Math.min(0.2, percent-(i*0.2));
			if (ext > 0) {
				internalCtx.fillStyle = progressSeg[i]
				internalCtx.fillRect(30+i*20, 71, ext*100, 2);
			}
		}

		internalCtx.fillStyle = "rgba(0, 0, 0, 0.2)"
		internalCtx.fillRect(30, 71, 100, 1);

		ctx.drawImage(internalCanvas, 0, 0, canvas.width, canvas.height);
	}

	function drawFrame() {
		if(!frameskip) {
			internalCtx.putImageData(GBScreen, 0, 0);
			ctx.drawImage(internalCanvas, 0, 0, canvas.width, canvas.height);
			prepareGBScreen();
		}
	}

	function printDebug() {
		var text = ""
		text += "A: "+ registers[0] +"<br>";
		text += "B: "+ registers[1] +"<br>";
		text += "C: "+ registers[2] +"<br>";
		text += "D: "+ registers[3] +"<br>";
		text += "E: "+ registers[4] +"<br>";
		text += "H: "+ registers[5] +"<br>";
		text += "L: "+ registers[6] +"<br>";
		text += "PC: "+ PC +"<br>";
		text += "SP: "+ SP +"<br>";
		document.getElementById("debug").innerHTML = text;
	}

	var timerMods = [63, 0, 3, 15]

	function handleScanCoin() {
		IORAM[0x41] |= 4
		if (IORAM[0x41]&0x40) {
			IORAM[0x0F] |= 0x2
		}
	}

	function cycle() {

		masterClock += Cycles;

		if (masterClock-audioCycles >= cyclesForSample) {
			audioCycles += cyclesForSample;
			squareWaveNode(0);
			squareWaveNode(1);
			waveNode(2);
			noiseNode(3);
			if (++AudioEngine.out.bufferPos == bufferSize) advanceBufWrite(AudioEngine.out);
		}

		while (masterClock-timerCycles >= 16) {
			divCounts = (divCounts+1)&63
			//timerCounts++
			timerCycles += 16;
			if ((divCounts&15) == 0) IORAM[0x04] = (IORAM[0x04]+1)&0xFF; //"hey rhys why don't you just do IORAM[0x04]++ ???" i can't because apple decided to break the basic functionality of typed arrays like utter twats
			if ((IORAM[0x07]&4) && ((divCounts&timerMods[IORAM[0x07]&3]) == 0)) {
				IORAM[0x05] = (IORAM[0x05]+1)&0xFF;
				//document.getElementById("debug").innerHTML = IORAM[0x05];
				if (IORAM[0x05] == 0) {
					IORAM[0x05] = IORAM[0x06];
					IORAM[0x0F] |= 0x4
				}
			}
		}

		GBObj.frameCycles += Cycles/CPUSpeed;
		lineCycles += Cycles/CPUSpeed;

		if (lineCycles >= 456) {
			IORAM[0x44] = (IORAM[0x44]+1)%154
			if ((IORAM[0x44] == IORAM[0x45]) && (IORAM[0x40]&0x80)) handleScanCoin(); //scanline coincidence
			else IORAM[0x41] &= 0xFB
			lineCycles -= 456
			if (IORAM[0x44] == 144) {
				drawFrame();
				LCDstate = 1;
				//vbl interrupt
				if (IORAM[0x40]&0x80) { 
					IORAM[0x0F] |= 0x1
					if (IORAM[0x41]&0x10) { //lcdstat vbl
						IORAM[0x0F] |= 0x2
					} 
				}
			} else if (IORAM[0x44] == 0) {
				LCDstate = 2;
				if ((IORAM[0x41]&0x20) && (IORAM[0x40]&0x80)) { //lcdstat mode2
					IORAM[0x0F] |= 0x2
				}
			}
		}

		if (LCDstate != 1) { //handling LCD STAT & STAT interrupts
			if (lineCycles <= 80) { //State 2 lasts 80
				if (LCDstate != 2) {
					LCDstate = 2
					if ((IORAM[0x41]&0x20) && (IORAM[0x40]&0x80)) {
						IORAM[0x0F] |= 0x2
					}
				}
			} else if (lineCycles <= 252) { //State 3 lasts 172
				if (LCDstate != 3) {
					LCDstate = 3
				}
			} else { //State 0 is the rest
				if (LCDstate != 0) {
					LCDstate = 0
					if (CGBDMA.active && CGBDMA.mode) { CGBDMAStep(16); }
					if (!(frameskip)) drawScanline(IORAM[0x44]); //draw scan on hblank (assuming the OAM and VRAM access = time the LCD is not drawing). this is not correct (breaks demotronic demo) but it will do for now
					if ((IORAM[0x41]&0x8) && (IORAM[0x40]&0x80)) {
						IORAM[0x0F] |= 0x2
					}
				}
			}
		}

		if (masterClock-soundCycles >= 8192*CPUSpeed) { //sound clock
			soundCycles += 8192*CPUSpeed

			if (IORAM[0x26]&0x80) {
				if ((soundPhase&1) == 0) {
					handleLengths();
				}
				if (soundPhase == 7) {
					handleEnvelope();
				}
				if ((soundPhase%4) == 2) {
					handleSweep(true);
				}
			}
			soundPhase = (soundPhase+1)&7
		}


		var mask = IORAM[0x0F] & ZRAM[0x7F]
		if (halted && mask) { //if we can stop the halt now, do it
			//console.log("halt time: "+(masterClock-haltTimerino))
			halted = false;
		} else if (halted) {
			//console.log("skipped "+);
			haltSkip();
			mask = IORAM[0x0F] & ZRAM[0x7F];
		}

		if (IME && mask) {
			IME = false;
			if (mask&0x1) {
				IORAM[0x0F] &= 0x1E
				RST(0x40);
			} else if (mask&0x2) {
				IORAM[0x0F] &= 0x1D
				RST(0x48);
			} else if (mask&0x4) {
				IORAM[0x0F] &= 0x1B
				RST(0x50);
			} else if (mask&0x8) {
				IORAM[0x0F] &= 0x17
				RST(0x58);
			} else if (mask&0x10) {
				IORAM[0x0F] &= 0xF
				RST(0x60);
			}
			//Cycles = 20; //2 cycles wait, 2 cycles push pc, one cycle set PC -- nvm breaks everything??
		}//else {
			Cycles = 0;
			if (halted) Cycles += 0;
			else if (CGBDMA.active && (!(CGBDMA.mode))) {
				CGBDMAStep(2);
				Cycles = 4*CPUSpeed;
			} else Instructions[MemRead(PC++)]();
			PC &= 0xFFFF;
		//}

		instCount++;
		//if ((!biosActive) && (instCount%10 == 0)) appendRegistersDebug();
	}

	function appendRegistersDebug() {
		registerDebug.push(registers[0]);
		registerDebug.push(registers[1]);
		registerDebug.push(registers[2]);
		registerDebug.push(registers[3]);
		registerDebug.push(registers[4]);
		registerDebug.push(registers[5]);
		registerDebug.push(registers[6]);
		registerDebug.push(PC);
		registerDebug.push(SP);
	}

	function CGBDMAStep(copy) {
		for (var i=0; i<copy; i++) {
			VRAM[IORAM[0x4F]*0x2000+(CGBDMA.destPos++)] = MemRead(CGBDMA.srcPos++);
		}
		CGBDMA.Tlength -= copy;
		if (((CGBDMA.Tlength) <= 0) || (CGBDMA.destPos>=0x2000)) {
			CGBDMA.active = false;
		}
	}

	function MemRead(pointer) {
		Cycles += 4;
		if ((pointer < 0x100) && biosActive) {
			if (CGB) return CGBbios[pointer];
			else return bios[pointer];
		} else if (pointer < 0x8000) {
			if (CGB && biosActive && (pointer >= 0x200) && (pointer < 0x900)) return CGBbios[pointer];
			else return MBCReadHandler(pointer) | 0; //can be undefined if stupid stuff happens
		} else if (pointer < 0xA000) {
			if (CGB) return VRAM[pointer-0x8000+0x2000*IORAM[0x4F]];
			else return VRAM[pointer-0x8000];
		} else if (pointer < 0xC000) {
			return MBCReadHandler(pointer) | 0; //even the RAM
		} else if (pointer < 0xE000) {
			if (CGB) {
				if (pointer < 0xD000) return RAM[pointer-0xC000];
				else return RAM[(pointer-0xD000)+0x1000*IORAM[0x70]];
			} else return RAM[pointer-0xC000];
		} else if (pointer < 0xFE00) {
			if (CGB) {
				if (pointer < 0xF000) return RAM[pointer-0xE000];
				else return RAM[(pointer-0xF000)+0x1000*IORAM[0x70]];
			} else return RAM[pointer-0xE000];
		} else if (pointer < 0xFEA0) {
			return OAM[pointer-0xFE00];
		} else if (pointer < 0xFF00) {
			return 0; //unusable
		} else if (pointer < 0xFF80) {
			return IOReadFunctions[pointer-0xFF00](pointer-0xFF00);
		} else {
			return ZRAM[pointer-0xFF80];
		}
	}

	function MemWrite(pointer, value) {
		Cycles += 4;
		if (pointer < 0x8000) {
			MBCWriteHandler(pointer, value);
		} else if (pointer < 0xA000) {
			if (CGB) VRAM[pointer-0x8000+0x2000*IORAM[0x4F]] = value;
			else VRAM[pointer-0x8000] = value;
		} else if (pointer < 0xC000) {
			MBCWriteHandler(pointer, value);
		} else if (pointer < 0xE000) {
			if (CGB) {
				if (pointer < 0xD000) RAM[pointer-0xC000] = value;
				else RAM[(pointer-0xD000)+0x1000*IORAM[0x70]] = value;
			} else RAM[pointer-0xC000] = value;
		} else if (pointer < 0xFE00) {
			console.log("writing to shadow ram?")
			debugger;
			if (CGB) {
				if (pointer < 0xF000) RAM[pointer-0xE000] = value;
				else RAM[(pointer-0xF000)+0x1000*IORAM[0x70]] = value;
			} else RAM[pointer-0xE000] = value;
		} else if (pointer < 0xFEA0) {
			OAM[pointer-0xFE00] = value;
		} else if (pointer < 0xFF00) {
		} else if (pointer < 0xFF80) {
			IOWriteFunctions[pointer-0xFF00](value, pointer-0xFF00);
		} else {
			ZRAM[pointer-0xFF80] = value;
		}
	}

	// ----- HALT CYCLE SKIP -----

	function haltSkip() {

		var interruptCycles = [
			Infinity, //vbl
			Infinity, //lcdstat
			Infinity, //clock
			Infinity,
			Infinity,
		]

		var skipTo = Infinity; //(70224-GBObj.frameCycles)*CPUSpeed; //max skip distance is the next frame

		//timer prediction

		if (IORAM[0x07]&4) { //only check if clock is enabled.
			//clock ticks until next interrupt given by 256-IORAM[0x05]
			//we need to work back to get the cycles until the next timer interrupt.
			
			var cycles = (256-IORAM[0x05])-1; //distance to timer overflow, minus 1 as the first tick's duration is NOT a full set of cycles, but instead a fraction.
			cycles *= 16*(timerMods[IORAM[0x07]&3]+1); //multiply by cycle length of one clock tick.
			cycles += 16-(masterClock-timerCycles); //time to first clock check
			cycles += 16*(timerMods[IORAM[0x07]&3]-(divCounts&timerMods[IORAM[0x07]&3])); //time after first clock tick to first div counter tick

			interruptCycles[2] = cycles;
			if ((ZRAM[0x7F]&0x4) && cycles<skipTo) skipTo = cycles;
		}

		if (IORAM[0x40]&0x80) { //only if screen enabled 
			//VBL predicion, can also cause an lcd stat interrupt!
			var linesToVBL = 144-IORAM[0x44];
			if (linesToVBL <= 0) linesToVBL += 154; //handle wraparound for vbl
			var cycles = ((linesToVBL-1)*456+(456-lineCycles))*CPUSpeed; //calculate cycles to next vbl, mul by CPUSpeed

			interruptCycles[0] = cycles;
			if (IORAM[0x41]&0x10) interruptCycles[1] = cycles; //lcdstat on vbl

			if ((ZRAM[0x7F]&0x1) && cycles<skipTo) skipTo = cycles; //if vbl interrupt flag set, wake on vbl.

			//LCDStat predicton.

			//lcdstat mode 0 fires at hblank
			//lcdstat mode 1 is vbl (already handled)
			//lcdstat mode 2 fires at start of horizontal raster
			//lcdstat mode 3 is scanline coincidence.

			//scanline coincidence:
			if (IORAM[0x41]&0x40) {
				linesToVBL = IORAM[0x45]-IORAM[0x44];
				if (linesToVBL <= 0) linesToVBL += 154; //handle wraparound for vbl
				var cycles = ((linesToVBL-1)*456+(456-lineCycles))*CPUSpeed; //calculate cycles to next vbl, mul by CPUSpeed
				
				if (interruptCycles[1]>cycles) interruptCycles[1] = cycles; //lcdstat on scancoin
			}

			if (IORAM[0x41]&0x28) { //lcdstat modes 0 and 2 only fire when screen is not in vblank.
				//if we are already past the last hblank or oam before the vblank we will need to add
				//the number of cycles it takes to bring us back to line 0.
				var blankCycles = 0;
				if (IORAM[0x44]>142) { //vbl active, we need to wait until screen resets to line 0.
					blankCycles = ((153-IORAM[0x44])*456+(456-lineCycles))*CPUSpeed
				}

				if (IORAM[0x41]&0x8) { //mode 0: hblank interrupt
					if ((IORAM[0x44]>143) || ((IORAM[0x44]==143) && lineCycles>252)) { //after lineCycle 252 in line 143 there are no more hblanks until the next interrupt.
						var cycles = blankCycles+(252*CPUSpeed)
						if (interruptCycles[1]>cycles) interruptCycles[1] = cycles; 
					} else {
						var cycles = (252-lineCycles);
						if (cycles<=0) cycles += 456;
						cycles *= CPUSpeed;
						if (interruptCycles[1]>cycles) interruptCycles[1] = cycles;
					}
				}

				if (IORAM[0x41]&0x20) { //mode 2: OAM interrupt
					if (IORAM[0x44]>143) {
						var cycles = blankCycles;
						if (interruptCycles[1]>cycles) interruptCycles[1] = cycles;
					} else {
						var cycles = (456-lineCycles)*CPUSpeed;
						if (interruptCycles[1]>cycles) interruptCycles[1] = cycles;
					}
				}
			}

			if ((ZRAM[0x7F]&0x2) && interruptCycles[1]<skipTo) skipTo = interruptCycles[1];
		}

		//now we have our predictions...
		//skip to next interrupt on main clock
		//set all interrupt flags that should be set
		//advance the screen, audio and timer correctly.

		var frameEnd = (70224-GBObj.frameCycles)*CPUSpeed;
		if (frameEnd<skipTo) {
			skipTo = frameEnd; //we will remain halted after we skip to the end of this frame
			//todo: remember where we're meant to skip to?
		} else {
			halted = false;
		}

		//screen update

		masterClock += skipTo;
		lineCycles += skipTo/CPUSpeed;

		//need to check if we bypass next scan's render cycle (at start of hblank), and draw the scan if we do.

		if ((LCDstate == 2 || LCDstate == 3) && lineCycles>252) {
			if (CGBDMA.active && CGBDMA.mode) { CGBDMAStep(16); }
			if (!(frameskip)) drawScanline(IORAM[0x44]); 
		}

		while (lineCycles >= 456) {
			IORAM[0x44] = (IORAM[0x44]+1)%154
			lineCycles -= 456
			if (IORAM[0x44] < 144 && lineCycles > 252) {
				if (CGBDMA.active && CGBDMA.mode) { CGBDMAStep(16); }
				if (!(frameskip)) drawScanline(IORAM[0x44]); 
			} else if (IORAM[0x44] == 144) {
				drawFrame();
			}
		}

		if ((IORAM[0x44] == IORAM[0x45]) && (IORAM[0x40]&0x80)) handleScanCoin(); //scanline coincidence
		else IORAM[0x41] &= 0xFB;

		if (IORAM[0x44] < 144) {
			if (lineCycles <= 80) LCDstate = 2;
			else if (lineCycles <= 252) LCDstate = 3;
			else LCDstate = 0;
		} else {
			LCDstate = 1;
		}

		//timer update

		var divCountUpdates = (masterClock-timerCycles)>>4; //number of div count updates
		
		IORAM[0x04] = (IORAM[0x04]+(divCountUpdates>>4))&0xFF; //advance static clock
		
		if (IORAM[0x07]&4) {
			//advance dynamic clock
			//need to be careful because usually this does not start from 0
			var mod = timerMods[IORAM[0x07]&3];
			var dynamicClockChanges = (divCountUpdates/(mod+1)) | 0;
			if ((divCountUpdates&mod)+(divCounts&mod) > mod) dynamicClockChanges++;
			IORAM[0x05] = IORAM[0x06]+(((IORAM[0x05]-IORAM[0x06]) + dynamicClockChanges)%(256-IORAM[0x06])); //overflows restart at 0. Bound clock sum to between start value and 255 with modulus.
		}
		divCounts = (divCounts+divCountUpdates)&63;
		timerCycles += 16*divCountUpdates; //left over cycles

		//sound update
		//we need to do this in chunks - meaning generate the audio in sound update space sized chunks.

		while (masterClock-soundCycles >= 8192*CPUSpeed) { //sound clock
			while (soundCycles-audioCycles >= cyclesForSample) {
				audioCycles += cyclesForSample;
				squareWaveNode(0);
				squareWaveNode(1);
				waveNode(2);
				noiseNode(3);
				if (++AudioEngine.out.bufferPos == bufferSize) advanceBufWrite(AudioEngine.out);
			}

			soundCycles += 8192*CPUSpeed
			if (IORAM[0x26]&0x80) {
				if ((soundPhase&1) == 0) {
					handleLengths();
				}
				if (soundPhase == 7) {
					handleEnvelope();
				}
				if ((soundPhase%4) == 2) {
					handleSweep(true);
				}
			}
			soundPhase = (soundPhase+1)&7;
		}

		while (masterClock-audioCycles >= cyclesForSample) {
			audioCycles += cyclesForSample;
			squareWaveNode(0);
			squareWaveNode(1);
			waveNode(2);
			noiseNode(3);
			if (++AudioEngine.out.bufferPos == bufferSize) advanceBufWrite(AudioEngine.out);
		}


		//set interrupt flags

		for (var i=0; i<5; i++) if (skipTo >= interruptCycles[i] && interruptCycles[i] != Infinity) IORAM[0x0F] |= 1<<i;
		GBObj.frameCycles += skipTo/CPUSpeed;

		return skipTo;
	}

	// ----- BEGIN INSTRUCTIONS -----


	//Bitwise Instructions

	function PrefixCB() {
		PC &= 0xFFFF;
		PrefixCBI[MemRead(PC++)]();
	}

	function RLC(reg) {
		flags[3] = registers[reg]>>7;
		registers[reg] = ((registers[reg]<<1)+flags[3])&0xFF;
		flags[0] = (registers[reg] == 0)?1:0;
		flags[1] = 0;
		flags[2] = 0;
	}

	function RRC(reg) {
		flags[3] = registers[reg]&0x1;
		registers[reg] = ((registers[reg]>>1)+(flags[3]<<7))&0xFF;
		flags[0] = (registers[reg] == 0)?1:0;
		flags[1] = 0;
		flags[2] = 0;
	}

	function RL(reg) {
		var temp = registers[reg]>>7;
		registers[reg] = ((registers[reg]<<1)+flags[3])&0xFF;
		flags[3] = temp;
		flags[0] = (registers[reg] == 0)?1:0;
		flags[1] = 0;
		flags[2] = 0;
	}

	function RR(reg) {
		var temp = registers[reg]&0x1;
		registers[reg] = ((registers[reg]>>1)+(flags[3]<<7))&0xFF;
		flags[3] = temp;
		flags[0] = (registers[reg] == 0)?1:0;
		flags[1] = 0;
		flags[2] = 0;
	}

	function SLA(reg) {
		flags[3] = registers[reg]>>7;
		registers[reg] = ((registers[reg]<<1)&0xFF);
		flags[0] = (registers[reg] == 0)?1:0;
		flags[1] = 0;
		flags[2] = 0;
	}

	function SRA(reg) {
		flags[3] = registers[reg]&0x1;
		registers[reg] = (((registers[reg]>>1)+(registers[reg]&0x80))&0xFF);
		flags[0] = (registers[reg] == 0)?1:0;
		flags[1] = 0;
		flags[2] = 0;
	}

	function SWAP(reg) {
		var nib = registers[reg]&0xF
		registers[reg] = (registers[reg]>>4)+(nib<<4)
		flags = [(registers[reg] == 0)?1:0, 0, 0, 0, 1]
	}

	function SRL(reg) {
		flags[3] = registers[reg]&0x1;
		registers[reg] = ((registers[reg]>>1)&0xFF);
		flags[0] = (registers[reg] == 0)?1:0;
		flags[1] = 0;
		flags[2] = 0;
	}

	//now the shifts and rotates for HL


	function RLCHL() {
		var HLN = (registers[5]<<8)+registers[6];
		var HL = MemRead(HLN);
		flags[3] = HL>>7;
		HL = ((HL<<1)+flags[3])&0xFF;
		flags[0] = (HL == 0)?1:0;
		flags[1] = 0;
		flags[2] = 0;
		MemWrite(HLN, HL);
	}

	function RRCHL() {
		var HLN = (registers[5]<<8)+registers[6];
		var HL = MemRead(HLN);
		flags[3] = HL&0x1;
		HL = ((HL>>1)+(flags[3]<<7))&0xFF;
		flags[0] = (HL == 0)?1:0;
		flags[1] = 0;
		flags[2] = 0;
		MemWrite(HLN, HL);
	}

	function RLHL() {
		var HLN = (registers[5]<<8)+registers[6];
		var HL = MemRead(HLN);
		var temp = HL>>7;
		HL = ((HL<<1)+flags[3])&0xFF;
		flags[3] = temp;
		flags[0] = (HL == 0)?1:0;
		flags[1] = 0;
		flags[2] = 0;
		MemWrite(HLN, HL);
	}

	function RRHL() {
		var HLN = (registers[5]<<8)+registers[6];
		var HL = MemRead(HLN);
		var temp = HL&0x1;
		HL = ((HL>>1)+(flags[3]<<7))&0xFF;
		flags[3] = temp;
		flags[0] = (HL == 0)?1:0;
		flags[1] = 0;
		flags[2] = 0;
		MemWrite(HLN, HL);
	}

	function SLAHL() {
		var HLN = (registers[5]<<8)+registers[6];
		var HL = MemRead(HLN);
		flags[3] = HL>>7;
		HL = ((HL<<1)&0xFF);
		flags[0] = (HL == 0)?1:0;
		flags[1] = 0;
		flags[2] = 0;
		MemWrite(HLN, HL);
	}

	function SRAHL() {
		var HLN = (registers[5]<<8)+registers[6];
		var HL = MemRead(HLN);
		flags[3] = HL&0x1;
		HL = (((HL>>1)+(HL&0x80))&0xFF);
		flags[0] = (HL == 0)?1:0;
		flags[1] = 0;
		flags[2] = 0;
		MemWrite(HLN, HL);
	}

	function SWAPHL() {
		var HLN = (registers[5]<<8)+registers[6];
		var HL = MemRead(HLN);
		var nib = HL&0xF
		HL = (HL>>4)+(nib<<4)
		MemWrite(HLN, HL);
		flags = [(HL == 0)?1:0, 0, 0, 0, 1];
	}

	function SRLHL() {
		var HLN = (registers[5]<<8)+registers[6];
		var HL = MemRead(HLN);
		flags[3] = HL&0x1;
		HL = ((HL>>1)&0xFF);
		flags[0] = (HL == 0)?1:0;
		flags[1] = 0;
		flags[2] = 0;
		MemWrite(HLN, HL);
	}

	//END SHIFTS AND ROTATES


	function BIT(bit, reg) {
		flags[0] = 1-(((bit == 0)?registers[reg]:(registers[reg]>>bit))&1); //bit == 0 check is to work around 32-bit iOS7 bug
		flags[1] = 0;
		flags[2] = 1;
	}

	function BITHL(bit) {
		var val = MemRead((registers[5]<<8)+registers[6])
		flags[0] = 1-(((bit == 0)?val:(val>>bit))&1); //bit == 0 check is to work around 32-bit iOS7 bug
		flags[1] = 0;
		flags[2] = 1;
	}

	function RES(bit, reg) {
		registers[reg] &= 255-(1<<bit)
	}

	function RESHL(bit) {
		var HL=(registers[5]<<8)+registers[6]
		MemWrite(HL, (MemRead(HL) & (255-(1<<bit))));
	}

	function SET(bit, reg) {
		registers[reg] |= 1<<bit
	}

	function SETHL(bit) {
		var HL=(registers[5]<<8)+registers[6]
		MemWrite(HL, (MemRead(HL) | (1<<bit)));
	}

	// LD and other load things

	function LD(dest, src) { // LD dest, src
		registers[dest] = registers[src]
	}

	function LDFHL(reg) { // "LD from HL": LD reg, (HL)
		registers[reg] = MemRead((registers[5]<<8)+registers[6]);
	}

	function LDTHL(reg) { // "LD to HL": LD (HL), reg
		MemWrite((registers[5]<<8)+registers[6], registers[reg]);
	}

	function LD_M_A() { // LD (a16), A
		PC &= 0xFFFF;
		var temp = MemRead(PC++);
		PC &= 0xFFFF;
		temp += (MemRead(PC++)<<8);
		MemWrite(temp, registers[0]);
	}

	function LD_A_M() { // LD A, (a16)
		PC &= 0xFFFF;
		var temp = MemRead(PC++);
		PC &= 0xFFFF;
		temp += (MemRead(PC++)<<8)
		registers[0] = MemRead(temp);
	}

	function LD_HL_SPM() { // LD HL, SP+r8 (that's a mouthful)
		PC &= 0xFFFF;
		var temp = MemRead(PC++);
		if (temp > 127) temp -= 256;
		var HL = (SP+temp)&0xFFFF;
		flags = [0, 0, (((SP&0xF) + (temp&0xF))&0x10)>>4, (((SP&0xFF)+(temp&0xFF))&0x100)>>8, 1]; //are the flags meant to be stupid on these ones?
		registers[5] = HL>>8;
		registers[6] = HL&0xFF;
		Cycles += 4;
	}

	function LDSPHL() { // LD SP, HL
		SP = (registers[5]<<8)+registers[6];
		Cycles += 4;
	}

	function LDSP() { // LD (a16), SP
		PC &= 0xFFFF;
		var temp = MemRead(PC++);
		PC &= 0xFFFF;
		temp += (MemRead(PC++)<<8);
		MemWrite(temp, SP&0xFF);
		MemWrite((temp+1)&0xFFFF, SP>>8);
	}

	function ADDSP() { // ADD SP, r8
		PC &= 0xFFFF;
		var temp = MemRead(PC++);
		if (temp > 127) temp -= 256;
		flags = [0, 0, (((SP&0xF) + (temp&0xF))&0x10)>>4, (((SP&0xFF)+(temp&0xFF))&0x100)>>8, 1];
		SP = (SP+temp)&0xFFFF;

		Cycles += 8;
	}

	//LDH

	function LDH_M_A() { // LDH (a8), A
		PC &= 0xFFFF;
		var temp = MemRead(PC++);
		MemWrite(temp+0xFF00, registers[0]);
	}

	function LDH_A_M() { // LDH A, (a8)
		PC &= 0xFFFF;
		var temp = MemRead(PC++);
		registers[0] = MemRead(temp+0xFF00);
	}

	function LDH_C_A() { // LDH (C), A
		MemWrite(registers[2]+0xFF00, registers[0]);
	}

	function LDH_A_C() { // LDH A, (C)
		registers[0] =  MemRead(registers[2]+0xFF00);
	}

	// Stack Instructions

	function PUSH(reg16) { // PUSH reg16
		StackPush((registers[reg16]<<8) + registers[reg16+1]);
		Cycles += 4;
	}

	function PUSHAF() { // PUSH AF
		StackPush((registers[0]<<8) + (flags[0]<<7) + (flags[1]<<6) + (flags[2]<<5) + (flags[3]<<4));
		Cycles += 4;
	}

	function POP(reg16) { // POP reg16
		registers[reg16] = MemRead((SP+1)&0xFFFF);
		registers[reg16+1] = MemRead(SP);
		SP = (SP+2)&0xFFFF

	}
 
	function POPAF() { // POP AF
		registers[0] = MemRead((SP+1)&0xFFFF);
		var temp = MemRead(SP);
		SP = (SP+2)&0xFFFF
		flags = [temp>>7, (temp>>6)&0x1, (temp>>5)&0x1, (temp>>4)&0x1, 1];
	}

	function StackPush(value) { //Generic Push Funcion
		SP = (SP-2)&0xFFFF;
		MemWrite(SP, value&0xFF)
		MemWrite((SP+1)&0xFFFF, value>>8)

	}

	function StackPop() { //Generic Pop Function
		SP = (SP+2)&0xFFFF
		return MemRead((SP-2)&0xFFFF)+(MemRead((SP-1)&0xFFFF)<<8)
	}

	// Standalone Instructions

	function DAA() {
		var tempa = registers[0]
		if (flags[1] == 0) {
			if ((flags[3] == 1) || (tempa > 0x99)) { tempa += 96; flags[3] = 1; }
			if ((flags[2] == 1) || ((tempa&0xF) > 0x9)) { tempa += 6; flags[2] = 0; }
		} else {
			if (flags[2] == 1) tempa -= 6;
			if (flags[3] == 1) tempa -= 96;
		}
		flags[2] = 0;
		registers[0] = tempa & 0xFF
		flags[0] = (registers[0] == 0)?1:0;
	}

	function CPL() {
		registers[0] = 255-registers[0]
		flags[1] = 1;
		flags[2] = 1;
	}

	function SCF() {
		flags[3] = 1;
		flags[1] = 0;
		flags[2] = 0;
	}

	function CCF() {
		flags[3] = 1-flags[3];
		flags[1] = 0;
		flags[2] = 0;
	}

	//Arithmetic (third quarter of instructions)

	function ADD(reg) { // ADD A, reg
		var temp = registers[0] + registers[reg]
		flags[2] = (((registers[0]&0xF) + (registers[reg]&0xF)))>>4
		flags[3] = temp>>8
		registers[0] = temp & 0xFF
		flags[0] = (registers[0] == 0)?1:0;
		flags[1] = 0;
	}

	function ADDHL() { // ADD A, HL
		var read = MemRead((registers[5]<<8)+registers[6]);
		var temp = registers[0] + read
		flags[2] = (((registers[0]&0xF) + (read&0xF)))>>4
		flags[3] = temp>>8
		registers[0] = temp & 0xFF
		flags[0] = (registers[0] == 0)?1:0;
		flags[1] = 0;
	}

	function ADDM() { // ADD A, d8
		PC &= 0xFFFF;
		var read = MemRead(PC++);
		var temp = registers[0] + read
		flags[2] = (((registers[0]&0xF) + (read&0xF)))>>4
		flags[3] = temp>>8
		registers[0] = temp & 0xFF
		flags[0] = (registers[0] == 0)?1:0;
		flags[1] = 0;
	}

	function ADC(reg) { // ADC A, reg
		var temp = registers[0] + registers[reg] + flags[3]
		flags[2] = (((registers[0]&0xF) + (registers[reg]&0xF) + flags[3]))>>4
		flags[3] = temp>>8
		registers[0] = temp & 0xFF
		flags[0] = (registers[0] == 0)?1:0;
		flags[1] = 0;
	}

	function ADCHL() { // ADC A, HL
		var read = MemRead((registers[5]<<8)+registers[6]);
		var temp = registers[0] + read + flags[3]
		flags[2] = (((registers[0]&0xF) + (read&0xF) + flags[3]))>>4
		flags[3] = temp>>8
		registers[0] = temp & 0xFF
		flags[0] = (registers[0] == 0)?1:0;
		flags[1] = 0;
	}

	function ADCM() { // ADC A, d8
		PC &= 0xFFFF;
		var read = MemRead(PC++);
		var temp = registers[0] + read + flags[3]
		flags[2] = (((registers[0]&0xF) + (read&0xF) + flags[3]))>>4
		flags[3] = temp>>8
		registers[0] = temp & 0xFF
		flags[0] = (registers[0] == 0)?1:0;
		flags[1] = 0;
	}

	function SUB(reg) { // SUB A, reg
		var temp = registers[0] - registers[reg]
		flags[2] = (((registers[0]&0xF) - (registers[reg]&0xF))<0)?1:0
		flags[3] = (temp<0)?1:0
		registers[0] = temp & 0xFF
		flags[0] = (registers[0] == 0)?1:0;
		flags[1] = 1;
	}

	function SUBHL() { // SUB A, HL
		var read = MemRead((registers[5]<<8)+registers[6]);
		var temp = registers[0] - read
		flags[2] = (((registers[0]&0xF) - (read&0xF))<0)?1:0
		flags[3] = (temp<0)?1:0
		registers[0] = temp & 0xFF
		flags[0] = (registers[0] == 0)?1:0;
		flags[1] = 1;
	}

	function SUBM() { // SUB A, d8
		PC &= 0xFFFF;
		var read = MemRead(PC++);
		var temp = registers[0] - read
		flags[2] = (((registers[0]&0xF) - (read&0xF))<0)?1:0
		flags[3] = (temp<0)?1:0
		registers[0] = temp & 0xFF
		flags[0] = (registers[0] == 0)?1:0;
		flags[1] = 1;
	}

	function SBC(reg) { // SBC A, reg
		var temp = registers[0] - registers[reg] - flags[3]
		flags[2] = (((registers[0]&0xF) - (registers[reg]&0xF) - flags[3])<0)?1:0
		flags[3] = (temp<0)?1:0
		registers[0] = temp & 0xFF
		flags[0] = (registers[0] == 0)?1:0;
		flags[1] = 1;

	}

	function SBCHL() { // SBC A, HL
		var read = MemRead((registers[5]<<8)+registers[6]);
		var temp = registers[0] - read - flags[3]
		flags[2] = (((registers[0]&0xF) - (read&0xF) - flags[3])<0)?1:0
		flags[3] = (temp<0)?1:0
		registers[0] = temp & 0xFF
		flags[0] = (registers[0] == 0)?1:0;
		flags[1] = 1;
	}

	function SBCM() { // SBC A, d8
		PC &= 0xFFFF;
		var read = MemRead(PC++);
		var temp = registers[0] - read - flags[3]
		flags[2] = (((registers[0]&0xF) - (read&0xF) - flags[3])<0)?1:0
		flags[3] = (temp<0)?1:0
		registers[0] = temp & 0xFF
		flags[0] = (registers[0] == 0)?1:0;
		flags[1] = 1;
	}

	function AND(reg) { // AND A, reg
		registers[0] &= registers[reg];
		flags = [(registers[0] == 0)?1:0, 0, 1, 0, 1]
	}

	function ANDHL() { // AND A, HL
		registers[0] &= MemRead((registers[5]<<8)+registers[6]);
		flags = [(registers[0] == 0)?1:0, 0, 1, 0, 1]
	}

	function ANDM() { // AND A, d8
		PC &= 0xFFFF;
		registers[0] &= MemRead(PC++);
		flags = [(registers[0] == 0)?1:0, 0, 1, 0, 1]
	}

	function XOR(reg) { // XOR A, reg
		registers[0] ^= registers[reg];
		flags = [(registers[0] == 0)?1:0, 0, 0, 0, 1]
	}

	function XORHL() { // XOR A, HL
		registers[0] ^= MemRead((registers[5]<<8)+registers[6]);
		flags = [(registers[0] == 0)?1:0, 0, 0, 0, 1]
	}

	function XORM() { // XOR A, d8
		PC &= 0xFFFF;
		registers[0] ^= MemRead(PC++);
		flags = [(registers[0] == 0)?1:0, 0, 0, 0, 1]
	}

	function OR(reg) { // OR A, reg
		registers[0] |= registers[reg];
		flags = [(registers[0] == 0)?1:0, 0, 0, 0, 1]
	}

	function ORHL() { // OR A, HL
		registers[0] |= MemRead((registers[5]<<8)+registers[6]);
		flags = [(registers[0] == 0)?1:0, 0, 0, 0, 1]
	}

	function ORM() { // OR A, d8
		PC &= 0xFFFF;
		registers[0] |= MemRead(PC++);
		flags = [(registers[0] == 0)?1:0, 0, 0, 0, 1]
	}

	function CP(reg) { // CP A, reg
		var temp = registers[0] - registers[reg]
		flags = [((temp&0xFF) == 0)?1:0, 1, (((registers[0]&0xF) - (registers[reg]&0xF))<0)?1:0, (temp<0)?1:0, 1]
	}

	function CPHL() { // CP A, HL
		var read = MemRead((registers[5]<<8)+registers[6]);
		var temp = registers[0] - read
		flags = [((temp&0xFF) == 0)?1:0, 1, (((registers[0]&0xF) - (read&0xF))<0)?1:0, (temp<0)?1:0, 1]
	}

	function CPM() { // CP A, d8
		PC &= 0xFFFF;
		var read = MemRead(PC++);
		var temp = registers[0] - read
		flags = [((temp&0xFF) == 0)?1:0, 1, (((registers[0]&0xF) - (read&0xF))<0)?1:0, (temp<0)?1:0, 1]
	}


	// General Purpose

	function CHL(value) { //silently changes HL, used with LD (HL+), A etc
		var HL = (registers[5]<<8)+registers[6]
		HL = (HL+value)&0xFFFF;
		registers[5] = HL>>8;
		registers[6] = HL&0xFF
	}

	function NOP() {
		//it doesn't do anything
	}

	function STOP() {
		if (CGB && (IORAM[0x4D]&1)) { 
			if (CPUSpeed == 1) {
				CPUSpeed = 2; 
				console.log("doublespeed!")
			} else {
				CPUSpeed = 1;
				console.log("singlespeed!")
			}
			cyclesForSample = (4194304*CPUSpeed)/audioSampleRate;
			IORAM[0x4D] = 0; 
		} else {
		//um
		}
	}

	function HALT() { //"halt" seems so much more menacing than "stop"
		halted = true;
	}

	function UNIMP() { //just ignore unimps
		//alert("wtf");
	}

	function EI() { //enables interrupts
		IME = true;
	}

	function DI() { //disables interrupts
		IME = false;
	}

	function RST(pointer) {
		PC &= 0xFFFF;
		StackPush(PC);
		PC = pointer+((pointer<0x40)?GBObj.RSToff:0);
		Cycles += 4;
	}

	// Jumps

	function JR(condition, target) { //Jump relative if the condition flag = the target value.
		Cycles += 4;
		if (flags[condition] == target) {
			PC &= 0xFFFF;
			var read = MemRead(PC++);
			if (read > 127) read -= 256;
			PC = (PC + read)&0xFFFF
		} else {
			PC = (PC+1)&0xFFFF
		}
	}

	function JP(condition, target) {
		if (flags[condition] == target) {
			var whathaveibcome = PC;
			PC &= 0xFFFF;
			var read = MemRead(PC++);
			PC &= 0xFFFF;
			PC = read + (MemRead(PC++)<<8)
			Cycles += 4;
		} else {
			PC = (PC+2)&0xFFFF
			Cycles += 8;
		}
	}

	function JPHL() { // JP (HL)
		PC = (registers[5]<<8)+registers[6];
	}

	function CALL(condition, target) {
		if (flags[condition] == target) {
			PC &= 0xFFFF;
			StackPush((PC+2)&0xFFFF);
			var read = MemRead(PC++);
			PC &= 0xFFFF;
			PC = read + (MemRead(PC++)<<8)
			Cycles += 4;
		} else {
			PC = (PC+2)&0xFFFF
			Cycles += 8;
		}
	}

	function NRET() { //normal ret since it takes less cycles
		PC = StackPop();
		Cycles += 4;
	}

	function RET(condition, target) {
		if (flags[condition] == target) {
			PC = StackPop();
			Cycles += 8;
		} else {
			Cycles += 4;
		}
	}

	// uh

	function LDMA(reg16) { // LD (reg16), A
		MemWrite((registers[reg16]<<8)+registers[reg16+1], registers[0]);
	}

	function LDAM(reg16) { // LD A, (reg16)
		registers[0] = MemRead((registers[reg16]<<8)+registers[reg16+1]);
	}

	function LD16M(reg16) { // LD reg16, d16
		PC &= 0xFFFF;
		registers[reg16+1] = MemRead(PC++);
		PC &= 0xFFFF;
		registers[reg16] = MemRead(PC++);
	}

	function LDSPM() { // LD SP, d16
		PC &= 0xFFFF;
		var temp = MemRead(PC++);
		PC &= 0xFFFF;
		temp += (MemRead(PC++)<<8)
		SP = temp
	}

	// Increment/Decrement

	function INC16(reg16) { // INC reg16
		var temp = (registers[reg16]<<8)+registers[reg16+1];
		temp = (temp+1)&0xFFFF;
		registers[reg16] = temp>>8;
		registers[reg16+1] = temp&0xFF;
		Cycles += 4;
	}

	function INCSP() { // INC SP
		SP = (SP+1)&0xFFFF;
		Cycles += 4;
	}

	function DEC16(reg16) { // DEC reg16
		var temp = (registers[reg16]<<8)+registers[reg16+1];
		temp = (temp-1)&0xFFFF;
		registers[reg16] = temp>>8;
		registers[reg16+1] = temp&0xFF;
		Cycles += 4;
	}

	function DECSP() { // DEC SP
		SP = (SP-1)&0xFFFF;
		Cycles += 4;
	}

	function INC(reg) { // INC reg
		flags[2] = (((registers[reg]&0xF)+1)>>4);
		registers[reg] = (registers[reg]+1)&0xFF;
		flags[0] = (registers[reg] == 0)?1:0;
		flags[1] = 0;
	}

	function INCHL() { // INC (HL)
		var HL = (registers[5]<<8)+registers[6];
		var value = MemRead(HL);
		MemWrite(HL, (value+1)&0xFF);
		flags[0] = (((value+1)&0xFF) == 0)?1:0;
		flags[1] = 0;
		flags[2] = (((value&0xF)+1)>>4);
	}

	function DEC(reg) { // DEC reg
		flags[2] = (((registers[reg]&0xF)-1)<0)?1:0;
		registers[reg] = (registers[reg]-1)&0xFF;
		flags[0] = (registers[reg] == 0)?1:0;
		flags[1] = 1;

	}

	function DECHL() { // DEC (HL)
		var HL = (registers[5]<<8)+registers[6];
		var value = MemRead(HL);
		MemWrite(HL, (value-1)&0xFF);
		flags[0] = (((value-1)&0xFF) == 0)?1:0;
		flags[1] = 1;
		flags[2] = (((value&0xF)-1)<0)?1:0;
	}

	function LDM(reg) { // LD reg, d8
		PC &= 0xFFFF;
		registers[reg] = MemRead(PC++);
	}

	function LDHLM() { // LD (HL), d8
		PC &= 0xFFFF;
		MemWrite((registers[5]<<8)+registers[6], MemRead(PC++));
	}

	function ADDHLSP() { // ADD HL, SP
		var HL = (registers[5]<<8)+registers[6]
		flags[3] = (HL+SP)>>16
		flags[2] = ((HL&0xFFF)+(SP&0xFFF))>>12
		HL = (HL+SP)&0xFFFF
		flags[1] = 0;
		registers[5] = HL>>8;
		registers[6] = HL&0xFF
		Cycles += 4;
	}

	function ADDHL16(reg16) { // ADD HL, reg16
		var HL = (registers[5]<<8)+registers[6]
		var value = (registers[reg16]<<8)+registers[reg16+1]
		flags[3] = (HL+value)>>16
		flags[2] = ((HL&0xFFF)+(value&0xFFF))>>12
		HL = (HL+value)&0xFFFF
		flags[1] = 0;
		registers[5] = HL>>8;
		registers[6] = HL&0xFF
		Cycles += 4;
	}

	// ----- END INSTRUCTIONS -----
}
