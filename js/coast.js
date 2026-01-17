// global vars
let req, xhr, start = 0, count = 0, decimals = 0, blink = false, selectedSize = 0, t;
let latency = 0,prev_ev_val = 0, byte = 0, bytetotal = 0, cancel = false;

// store <button> tags in array
const btns = Array.from (document.querySelectorAll ('button'));

// add click handler to buttons
btns.forEach (btn => {
	btn.addEventListener ('click', testDownload);
});


/**
* Round number to defined decimals for timing display
*
* @param   {number}  num   Number to round
* @param   {number}  deci  Number of decimals to round to
* @return  {string}        Rounded number with trailing zeros
*/
function dec (num, deci) {

	let amount;
	let result;
	let missing;
	let i;

	// rounding
	if (deci) {
		amount = Math.pow (10, deci || 1);
		result = Math.round (num * amount) / amount;
	} else {
		result = Math.round (num);
	}

	// force trailing zeros
	result = String (result);

	if (!deci) {
		return result;
	}

	if (!~result.indexOf ('.')) {
		missing = deci;
		result += '.';
	} else {
		missing = deci - result.split ('.')[1].length;
	}

	if (missing) {
		for (i = missing; i > 0; i--) {
		result += '0';
		}
	}

	// done
	return result;
}


/**
* Test completed
*
* @return  {void}
*/
function testDone () {

	const diff = (Date.now() - start) / 1000;

	if (req.readyState !== 4) {
		return;
	}

	checkUploadSpeed(3);

	document.querySelector ('progress').style.visibility = 'hidden';
	document.querySelector ('progress').value = 0;
	document.querySelector ('#result').className = 'resultDone';
	document.querySelector ('#eta').innerHTML = dec (diff, 2) + ' sec';
	document.getElementById('btnx').style.display = "none";
	document.getElementById('handle').style.visibility = "hidden";
	document.getElementById('download-box').className = "dl-result-2";
    selectedSize = 0;
	prev_ev_val = 0;
	bytetotal = 0;
	byte = 0;

	if(blink){
		clearInterval(t);
		blink = false;
		document.getElementById('l5').style.visibility = "visible";
	}
	//req = null;
}

/**
* Test progress handler
*
* @param   {Event}  ev  XMLHttpRequest.onprogress event
* @return  {void}
*/
function testRunning (ev) {

	const now = Date.now ();

	let percent = 0.0;
	let Bps = 0;
	let eta = 0;

	if (ev.loaded > 0) {

		byte = ev.loaded - prev_ev_val;
		Bps = ev.loaded / ((now - start) / 1000);
		mbit = Bps / 1024 / 1024 * 8;
		count++;
		bytetotal += byte;
		percent = ev.loaded / ev.total * 100.0;
		eta = (ev.total - ev.loaded) / Bps;
		prev_ev_val = ev.loaded

	}

    document.getElementById('btnx').style.display = "block";
	document.getElementById('handle').style.visibility = "visible";
	document.getElementById('download-box').className = "dl-result-1";
	document.getElementById('progress').value = percent;
	document.getElementById('result').innerHTML = '<font color="#999">⇓</font>&nbsp;' + dec (mbit, decimals) + ' Mbps';
	document.getElementById('eta').innerHTML = dec (eta, decimals) + ' sec';
	document.getElementById('dl-stats').innerHTML += count + ": processing " + byte + "\tbytes at " + Math.round(mbit) + "Mbps \tTotal Download: "+dec(bytetotal/1024/1014,0)+"MB\n" ;


	// stop plotting chart after passing over 325 count
    if(count < 200){
	handleDownloadChart(mbit);
	document.getElementById('dl-chart').style.display = "inline-block";
	}
	handleGaugeHandler(mbit);
}

/**
* Start new test
* and abort any running test
*
* @param   {Event}  ev  Click event
* @return  {void}
*/
function testDownload (ev) {

	if (req) {
		req.abort ();
	}

	req = new XMLHttpRequest;

	document.getElementById('dl-chart').innerHTML = '';
    document.getElementById("latency-box").style.display = 'none';
    document.getElementById("upload-box").style.display = 'none';
	document.getElementById('handle').style.visibility = "visible";
	document.getElementById('download-box').className = "dl-result-1";
	document.getElementById('result').innerHTML = 'Speedtest';
	document.getElementById('eta').innerHTML = 'choose a size';
	handleGaugeHandler(0);
	prev_ev_val = 0;
	document.getElementById('dl-stats').innerHTML = "";
	document.getElementById('ul-stats').innerHTML = "";

	if(ev.target.dataset.file != ""){

		latencyCheck();

		start = Date.now ();
		count = 0;

		btns.forEach (btn => {
			btn.className = '';
		});

		ev.target.className = 'choice';
		document.getElementById('progress').value = 0;
		document.getElementById('progress').style.visibility = 'visible';
		req.onprogress = testRunning;
		req.onreadystatechange = testDone;

		// load file avoiding the cache
		req.open ('GET', ev.target.dataset.file + '?' + start, true);

		const getSize = parseInt(ev.target.dataset.file.replace("MB.bin",""),10);
		console.log(getSize);
		selectedSize = getSize;


		req.send (null);
	} else {
		cancel = true;
	}
}


/**
* Build Chart base of bandwidth parameters
*
* @param   {Number}  val
* @return  {void}
*/
const handleDownloadChart = (val) => {

    var div = document.createElement('div');
    div.style.backgroundColor = "#00ff9a";
	div.style.borderTop = "1px solid blue";
    div.style.display = "inline-block";

	switch(selectedSize) {

		case 5 :
			if(val > 0 )  div.style.width = "1.00px";
			if(val > 100 )  div.style.width = "6.00px";
			if(val > 280 )  div.style.width = "7.35px";
			if(val > 500 )  div.style.width = "8.50px";
			if(val > 750 )  div.style.width = "9.00px";
			if(val > 1000 ) div.style.width = "10.0px";
			break;
		case 100:
			if(val > 0 )  div.style.width = "0.50px";
			if(val > 100 )  div.style.width = "3.00px";
			if(val > 280 )  div.style.width = "4.70px";
			if(val > 500 )  div.style.width = "6.50px";
			if(val > 750 )  div.style.width = "7.00px";
			if(val > 1000 ) div.style.width = "9.60px";
			break;
		case 1000:
			if(val > 0 )  div.style.width = "0.05px";
			if(val > 100 )  div.style.width = "0.30px";
			if(val > 280 )  div.style.width = "0.45px";
			if(val > 500 )  div.style.width = "0.50px";
			if(val > 750 )  div.style.width = "0.60px";
			if(val > 1000 ) div.style.width = "0.70px";
			break;
	}

	var adjustHeight = 3; /* for low bandwidth speed network */
    div.style.height = (Math.log(val)*Math.log(val) + (val<25? adjustHeight:0)).toString() + "px";
    document.getElementById('dl-chart').appendChild(div);
}

/**
* rendering Speed gauge handle
*
* @param   {Number}  val
* @return  {void}
*/
const handleGaugeHandler = (val) => {
	var arc = 270;
	var max = 1000;

	if (val > max ){

		if(!blink) {
			var blink_speed = 100; // every 1000 == 1 second, adjust to suit
			t = setInterval(function () {
				var ele = document.getElementById('l5');
				ele.style.visibility = (ele.style.visibility == 'hidden' ? '' : 'hidden');
			}, blink_speed);
			blink = true;
		}
		val = max;
	} else{
		clearInterval(t);
		blink = false;
		document.getElementById('l5').style.visibility = "visible";
	}

	if (val < 25) {
		max = 25;
		document.getElementById("l2").innerHTML = "6";
		document.getElementById("l3").innerHTML = "13";
		document.getElementById("l4").innerHTML = "19";
		document.getElementById("l5").innerHTML = "25Mb";
	}
	else if (val < 50) {
		max = 50;
		document.getElementById("l2").innerHTML = "12";
		document.getElementById("l3").innerHTML = "25";
		document.getElementById("l4").innerHTML = "37";
		document.getElementById("l5").innerHTML = "50Mb";
	}
	else if (val < 100) {
		max = 100;
		document.getElementById("l2").innerHTML = "25";
		document.getElementById("l3").innerHTML = "50";
		document.getElementById("l4").innerHTML = "75";
		document.getElementById("l5").innerHTML = "100Mb";
	} else {
        max = 1000;
		document.getElementById("l2").innerHTML = "250";
		document.getElementById("l3").innerHTML = "500";
		document.getElementById("l4").innerHTML = "750";
		document.getElementById("l5").innerHTML = "1Gb";
	}

	document.getElementById("handle").style.transform = "rotate(" + ( arc * val / max) + "deg)";

}

/**
* Check Latency by fetching icon.png file from server
*
* @param   {String}  ev  Click event
* @return  {void}
*/
async function latencyCheck() {
	var startDate = new Date();
    let response = await fetch('/coast-express/images/icons/icon.png',{
		method: "GET",
		headers: {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Credentials": true,
		"Content-Type": "application/x-www-form-urlencoded",
		}
	});
    if (response.status === 200) {
		var endDate   = new Date();
		latency = (endDate.getTime() - startDate.getTime()) / 1000;
        document.getElementById("latency").innerHTML = latency + " s";
        document.getElementById("latency-box").style.display = 'block';
    }
}

/**
* Upload test
*
* @param   {Number}  iterations
* @param   {function} check
* @param   {functuon} update
* @return  {void}
*/
function checkUploadSpeed(iterations) {
  xhr = new XMLHttpRequest();
  var average = 0;
  var count = 0;
  var timer = window.setInterval(check, 100); //check every .1 seconds
  check();

  function check() {
      var url = '/coast-express?cache=' + Math.floor(Math.random() * 10000); //prevent url cache
      var data = getRandomString(1); //1 megabit POST size handled by all servers
      var startTime;
      var speed = 0;

    xhr.onload = function() {

        speed = Math.round(1024 / ((new Date() - startTime) / 1000));
        average == 0 ? average = speed : average = Math.round((average + speed) / 2);

		document.getElementById('speed').textContent = 'speed: ' + speed/1000 + 'Mbps';
		document.getElementById('average').textContent = Math.round(average/1000).toString() + ' Mbps';

        count++;
        if (count == iterations && !cancel) {
          window.clearInterval(timer);
          document.getElementById("upload-box").style.display = 'block';
        };
		document.getElementById('ul-stats').innerHTML += count + ": " + Math.round(speed/1000) + " Mbps\n";

    };
    xhr.open('POST', url, false);
	xhr.setRequestHeader('Content-type', 'application/text');
    startTime = new Date();
    xhr.send(data);
  };

  function getRandomString(size) {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789~!@#$%^&*()_+`-=[]\{}|;':,./<>?", //random data prevents gzip effect
      iterations = size * 1024 * 1024, //Mbits
      result = '';
    for (var index = 0; index < iterations; index++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    };
    return result;
  };
};
