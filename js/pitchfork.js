//http://lukecod.es/blog/2012/02/14/pitchfork-dot-com-album-rating-api/
//modified with: http://stackoverflow.com/questions/8537601/is-there-a-free-json-proxy-server-which-supports-cors-or-jsonp
(function($, undefined) {
    
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
    
    function getAlbumUrl(data, textStatus, xhr) {

 var searchData = data.query.results.json.json;//data.value.items[0].json,
  console.log(searchData);
        reviews = {},
        theResult = {};
        
        // Find the reviews object
        for (var i = 0, m = searchData.length; i < m; i++) {
            if (searchData[i].label.toLowerCase() === "reviews") {
                reviews = searchData[i];
                break;
            }
        }
        
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
            
            // Populate album, artist data from search query
            $('#result_artist').text(theResult.artist);
            $('#result_album').text(theResult.album);
            
            // Get the album score
            getAlbumScore("http://pitchfork.com" + theResult.url);
            
        } else {
            console.error('The search returned no reviews');
        }
    }
    
    function getAlbumScore(url) {
        
        // Create YQL query to get span containing score
        var query = encodeURIComponent('select content from html where url="' + url + '" and compat="html5" and xpath=\'//div[@id="main"]/ul/li/div[@class="info"]/span\''),
        
        // JSONP url for YQL query
        yqlurl = 'http://query.yahooapis.com/v1/public/yql?q=' + query + '&format=json&callback=?';
        
        $.ajax({
               url: yqlurl,
               type: 'GET',
               dataType: 'jsonp',
               success: function(data, textStatus, xhr) {
               $('#score').text(data.query.results.span);
               },
               error: function(xhr, textStatus, errorThrown) {
               console.error(xhr, textStatus, errorThrown);
               }
               });
    }
    
    function searchPitchfork() {
        
        var album = encodeURIComponent(sanitize($('#album').attr("value"))),
        artist = encodeURIComponent(sanitize($('#artist').attr("value")));
 
        $.ajax({
            url: "http://query.yahooapis.com/v1/public/yql",
            type: 'GET',
            dataType: 'jsonp',
            data: {
                   q:      "select * from json where url=\"http://pitchfork.com/search/ac/?query=" +album+"%20-%20"+artist+ "\"",
                   format: "json"
            },
            success: getAlbumUrl,
            error: function(xhr, textStatus, errorThrown) {
                   console.error(xhr, textStatus, errorThrown);
            }
        });
 
    }
    
    // Run on dom ready
    $(searchPitchfork);
    
})(jQuery);