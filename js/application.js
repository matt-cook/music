//pitchfork scraping originally from:
//http://lukecod.es/blog/2012/02/14/pitchfork-dot-com-album-rating-api/
(function ($, undefined) {

    var lastfm_key = "329696137d0d82dbc429a8091d00b9fd";
    var lastfm_user = "lookitscook";
    var lastfm_requestDelay = 1000; //in milliseconds

    var url = "http://ws.audioscrobbler.com/2.0/?method=user.getWeeklyChartList&user=" + lastfm_user + "&api_key=" + lastfm_key + "&format=json";

    var charts = localcake.get(url);
    if (charts) getCharts(charts);
    else {
        $.ajax({
            url: url,
            type: 'GET',
            dataType: 'jsonp',
            success: foundChartList(url),
            error: function (xhr, textStatus, errorThrown) {
                console.error(xhr, textStatus, errorThrown);
            }
        });
    }

    function foundChartList(url) {
        return function (data, textStatus, request) {
            var charts = data.weeklychartlist.chart;
            localcake.put(url, charts);
            getCharts(charts);
        }
    }

    function getCharts(chart) {
        for (i = 100; i < chart.length && i < 115; i++) {
            var from = chart[i].from;
            var to = chart[i].to;
            var url = "http://ws.audioscrobbler.com/2.0/?method=user.getweeklyalbumchart&user=" + lastfm_user + "&api_key=" + lastfm_key + "&format=json&from=" + from + "&to=" + to;
            var albums = localcake.get(url);
            if (albums) {
                if (albums.length) getScores(albums, from, to);
            } else {
                $.ajax({
                    url: url,
                    type: 'GET',
                    dataType: 'jsonp',
                    success: foundChart(url, from, to),
                    error: function (xhr, textStatus, errorThrown) {
                        console.error(xhr, textStatus, errorThrown);
                    }
                });
            }
        }
    }

    function foundChart(url, from, to) {
        return function (data, textStatus, request) {
            var albums = new Array();
            if (data.weeklyalbumchart && data.weeklyalbumchart.album) {
                if (Object.prototype.toString.call(data.weeklyalbumchart.album) === '[object Array]') {
                    for (var i = 0; i < data.weeklyalbumchart.album.length; i++) {
                        albums[i] = data.weeklyalbumchart.album[i];
                    }
                } else albums[0] = data.weeklyalbumchart.album;
            }
            localcake.put(url, albums);
            if (albums.length) getScores(albums, from, to);
        }
    }

    function getScores(albums, from, to) {
        for (var i = 0; i < albums.length; i++)
            searchPitchfork(albums[i].name, albums[i].artist["#text"], from, to);
    }

    function sanitize(str) {
        return str.toLowerCase();
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

    function getReviewUrl(data, url, from, to, album, artist) {
        var searchData = data.query.results.json.json;
        reviews = {},
        theResult = {};

        // Find the reviews object
        for (var i = 0, m = searchData.length; i < m; i++) {
            if (searchData[i].label.toLowerCase() === "reviews") {
                reviews = searchData[i];
                break;
            }
        }
        var reviewUrl = -1;
        if (!$.isEmptyObject(reviews) && !$.isEmptyObject(reviews.objects)) {
            // We have results
            reviews = (reviews.objects.length > 0) ? reviews.objects : [reviews.objects];

            if (reviews.length === 1) {
                // Only 1 result, use it
                theResult = returnResult(reviews[0]);
            } else {
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
            }

            if ($.isEmptyObject(theResult)) {
                // No exact match was found for the multiple results
                // Might as well use pitchfork's top match
                theResult = returnResult(reviews[0]);
            }

            reviewUrl = "http://pitchfork.com" + theResult.url;
            processReview(reviewUrl, from, to, album, artist);

        } else {
            console.error('The search returned no reviews');
        }
        localcake.put(url, reviewUrl);
    }

    function processReview(url, from, to, album, artist) {
        var score = localcake.get(url);
        if (score) processScore(score, from, to, album, artist);
        else getAlbumScore(url, from, to, album, artist);
    }

    function getAlbumScore(url, from, to, album, artist) {

        // Create YQL query to get span containing score
        var query = encodeURIComponent('select content from html where url="' + url + '" and compat="html5" and xpath=\'//div[@id="main"]/ul/li/div[@class="info"]/span\''),

            // JSONP url for YQL query
            yqlurl = 'http://query.yahooapis.com/v1/public/yql?q=' + query + '&format=json&callback=?';

        $.ajax({
            url: yqlurl,
            type: 'GET',
            dataType: 'jsonp',
            success: scoreFound(url, from, to, album, artist),
            error: function (xhr, textStatus, errorThrown) {
                console.error(xhr, textStatus, errorThrown);
            }
        });
    }

    function scoreFound(url, from, to, album, artist) {
        return function (data, textStatus, xhr) {
            processScore(data.query.results.span, from, to, album, artist);
            localcake.put(url, data.query.results.span);
        }
    }

    function processScore(score, from, to, album, artist) {
        var d = new Date(from*1000);
        var year = d.getFullYear();
        var month = d.getMonth()+1;
        var day = d.getDate();
        console.log(' '+month+'/'+day+'/'+year+ ' : ' + album + ' - ' + artist + ' : ' + score);
    }

    function searchPitchfork(album, artist, from, to) {


        var url = "http://pitchfork.com/search/ac/?query=" + encodeURIComponent(sanitize(album)) + "%20-%20" + encodeURIComponent(sanitize(artist));

        var reviewUrl = localcake.get(url);
 if (reviewUrl) {
    if(reviewUrl != -1) processReview(reviewUrl, from, to, album, artist);
 }
        else {
            $.ajax({
                url: "http://query.yahooapis.com/v1/public/yql",
                type: 'GET',
                dataType: 'jsonp',
                data: {
                    q: "select * from json where url=\"" + url + "\"",
                    format: "json"
                },
                success: matchFound(url, from, to, album, artist),
                error: function (xhr, textStatus, errorThrown) {
                    console.error(xhr, textStatus, errorThrown);
                }
            });
        }
    }

    function matchFound(url, from, to, album, artist) {
        return function (data, textStatus, xhr) {
            getReviewUrl(data, url, from, to, album, artist);
        }
    }

})(jQuery);