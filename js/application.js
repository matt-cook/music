//pitchfork scraping originally from:
//http://lukecod.es/blog/2012/02/14/pitchfork-dot-com-album-rating-api/

(function ($, undefined) {
 $(document).ready(function(){
    var lastfm_key = "329696137d0d82dbc429a8091d00b9fd";
    var lastfm_user = "lookitscook";
    var lastfm_requestDelay = 1000; //in milliseconds
    var yahoo_requestDelay = 500;
    var results = [], series = [];
    var fitter = new LineFitter();

    var url = "http://ws.audioscrobbler.com/2.0/?method=user.getWeeklyChartList&user=" + lastfm_user + "&api_key=" + lastfm_key + "&format=json";


    var plot = $.plot($("#chart"),[series],{
        series: {
            lines: {
                show: true,
                fill: true,
                fillColor: '#EBEBEB'
            },
            points:{
              show:true,
              fillColor:'#fff'
            },
            highlightColor: '#000',
            shadowSize:0
        },
        colors: ['#ddd','#ccc'],
        grid: {
            show: false,
            hoverable: true,
            clickeable: true
        },
        xaxis: {
            mode: "time",
            ticks: false
        },
        yaxis: {
            min:0,
            max: 14,
            ticks: false
        }
    });


    function showTooltip(x, y, contents) {
        $('<div id="tooltip">' + contents + '</div>').css( {
            position: 'absolute',
            display: 'none',
            top: y + 5,
            left: x + 5,
            padding: '5px',
            color: '#fff',
            'background-color': '#000'
        }).appendTo("body").fadeIn(200);
    }
    
    var previousPoint = null;
    $("#chart").bind("plothover", function (event, pos, item) {
        $("#x").text(pos.x.toFixed(2));
        $("#y").text(pos.y.toFixed(2));

        if (item) {
            if (previousPoint != item.dataIndex) {
                previousPoint = item.dataIndex;
                
                $("#tooltip").remove();
                var x = item.datapoint[0].toFixed(2),
                    y = item.datapoint[1].toFixed(2);
                
                showTooltip(item.pageX, item.pageY, jQuery.format.date(parseInt(x),'MMM yyyy') + ": " + y);
            }
        }
        else {
            $("#tooltip").remove();
            previousPoint = null;            
        }
    });

 
    //ajax function that will only make one remote call per 'delay' ms.
    //will also attempt to pull from cupcake localstorage before remote
    //resources must be an array of objects with parameter URL (among others if needed)
    function get(resources,parser,callback,i,delay){
        if(typeof i == "undefined") i = 0;
        if(i != resources.length){
            var response = localcake.get(resources[i].url);
            if(response) {
                callback(response,resources[i]);
                get(resources,parser,callback,++i,delay);
            }else{
                setTimeout(makeRequest(resources[i],resources,parser,callback,i,delay),delay);
                function makeRequest(resource,resources,parser,callback,i,delay){
                    return function(){
                        $.ajax({
                            url: resource.url,
                            type: 'GET',
                            dataType: 'jsonp',
                            success: succeeded(resource),
                            error: function (xhr, textStatus, errorThrown) {
                                console.error(xhr, textStatus, errorThrown);
                            }
                        });
                        function succeeded(resource){
                            return function (data, textStatus, request) {
                                var response = parser(data);
                                localcake.put(resource.url, response);
                                callback(response,resource);
                            }
                        }
                        get(resources,parser,callback,++i,delay);
                    }
                }
            }
        }
    }
 
    get(new Array(new Object({url:url})),parseChartList,getCharts,0,lastfm_requestDelay);
 
    function parseChartList(data){
        return data.weeklychartlist.chart;
    }

    function getCharts(data) {
        var charts = new Array();
        for (i = 0; i < data.length; i++) {
            var from = data[i].from;
            var to = data[i].to;
            charts.push(new Object({
                url:"http://ws.audioscrobbler.com/2.0/?method=user.getweeklyalbumchart&user=" + lastfm_user + "&api_key=" + lastfm_key + "&format=json&from=" + from + "&to=" + to,
                from: from,
                to: to
            }));
        }
        get(charts,parseChart,getReviews,0,lastfm_requestDelay);
    }

    function parseChart(data) {
        var albums = new Array();
        if (data.weeklyalbumchart && data.weeklyalbumchart.album) {
            if (Object.prototype.toString.call(data.weeklyalbumchart.album) === '[object Array]') {
                for (var i = 0; i < data.weeklyalbumchart.album.length; i++) {
                    albums.push(data.weeklyalbumchart.album[i]);
                }
            } else albums.push(data.weeklyalbumchart.album);
        }
        return albums;
    }

    function getReviews(albums,chart) {
        if(albums.length){
            var searches = new Array();
            for (var i = 0; i < albums.length; i++){
                var s = jQuery.extend(true, {}, chart); //deep copy
                s.album = albums[i].name;
                s.artist = albums[i].artist["#text"];
                s.playcount = parseInt(albums[i].playcount);
                var url = "http://pitchfork.com/search/ac/?query=" + encodeURIComponent(sanitize(s.album)) + "%20-%20" + encodeURIComponent(sanitize(s.artist));
                var q = encodeURIComponent("select * from json where url=\"" + url + "\"");
                s.url = "http://query.yahooapis.com/v1/public/yql?q="+q+"&format=json";
                searches.push(s);
            }
            get(searches,parseReview,getScores,0,yahoo_requestDelay);
        }
    }
 
    function parseReview(data){
        var reviewUrl = -1;
        var searchData = data.query.results.json.json;
        reviews = {},
        theResult = {};
        // Find the reviews object
        for (var i = 0, m = searchData.length; i < m; i++) {
            if (searchData[i].label.toLowerCase() === "reviews") {
                reviews = jQuery.extend(true, {}, searchData[i]);
                break;
            }
        }
        if (!$.isEmptyObject(reviews) && !$.isEmptyObject(reviews.objects)) {
            // We have results
            reviews = (reviews.objects.length > 0) ? reviews.objects : [reviews.objects];

            if (reviews.length === 1) {
                // Only 1 result, use it
                theResult = returnResult(reviews[0]);
            }
            //not handling multiple results for now, will fall back to first result
            /* else {
                for (var i = 0, m = reviews.length; i < m; i++) {
                    var p4kResult = normalizeP4kResult(reviews[i].name),
                        p4kArtist = p4kResult.artist,
                        p4kAlbum = p4kResult.album;
                   
                    if ((p4kArtist === artist || artist === '') && (p4kAlbum === album || album === '')) {
                        // we found an exact match!
                        theResult = returnResult(reviews[i]);
                        break;
                    }
                }
            }*/

            if ($.isEmptyObject(theResult)) {
                // No exact match was found for the multiple results
                // Might as well use pitchfork's top match
                theResult = returnResult(reviews[0]);
            }

            reviewUrl = "http://pitchfork.com" + theResult.url;
        }
        return reviewUrl;
    }
 
    function getScores(reviewURL,record){
        if(reviewURL && reviewURL != -1){
            record.reviewURL = reviewURL;
            var q = encodeURIComponent('select content from html where url="' + reviewURL + '" and compat="html5" and xpath=\'//div[@id="main"]/ul/li/div[@class="info"]/span\'');
            record.url = 'http://query.yahooapis.com/v1/public/yql?q=' + q + '&format=json&callback=?'
            get(new Array(record),parseScore,scoreFound,0,yahoo_requestDelay);
        }
    }
 
    function parseScore(data){
        return data.query.results.span;
    }
 
    function scoreFound(score,record){
    
        if(Array.isArray(score)){
            //use average review score, if multiple reviews
            var sum = 0;
            for(var i = 0; i < score.length; i++)
                sum += parseInt(score[i]);
            record.score = sum/score.length;
        }else
            record.score = parseInt(score);
        
        //don't need to store the final query URL
        delete record["url"]; 
        
        //calculate weekly score
        //playcount of individual albums is factored into weekly average
        if(results[record.to]){
            fitter.subtract(record.to*1000,results[record.to].score);
            results[record.to].sum += record.score * record.playcount;
            results[record.to].playcount += record.playcount;
            results[record.to].data.push(record);
            results[record.to].score = results[record.to].sum / results[record.to].playcount;
            series[results[record.to].index][1] = results[record.to].score;
            fitter.add(record.to*1000,results[record.to].score)
        }else{
            series.push([record.to*1000,record.score]);
            results[record.to] = {
                data: [record],
                playcount: record.playcount,
                sum: record.score * record.playcount,
                score: record.score,
                timestamp: record.to,
                index: series.length-1
            }
            fitter.add(record.to*1000,record.score);
        }
        var sortedSeries = series.slice(0).sort(function(a,b){
            return a[0] - b[0];
        });
        var xMin = sortedSeries[0][0];
        var xMax = sortedSeries[sortedSeries.length-1][0];
        var fittedSeries = [[xMin,fitter.project(xMin)],[xMax,fitter.project(xMax)]];
        plot.setData([{
            data:sortedSeries
        },{
            data: fittedSeries,
            lines: { show: true, fill: false },
            fillColor: '#C02942',
            points:{ show:false }
        }]);
        plot.setupGrid();
        plot.draw();
    } 
 
    //----- utility functions for pitchfork search -----//
    
    function sanitize(str) {
        return str ? str.toLowerCase() : str;
    }

    function normalizeP4kResult(result) {
        var parts = result.split(' - '),
            artist = parts[0],
            album = parts[1];

        return {
            artist: sanitize(artist),
            album: sanitize(album)
        };
    }

    function returnResult(obj) {
        return $.extend({
            url: obj.url
        }, normalizeP4kResult(obj.name));
    }
 });
})(jQuery);