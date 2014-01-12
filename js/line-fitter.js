//modified from http://stackoverflow.com/questions/11796810/calculate-trendline-and-predict-future-results
function LineFitter()
{
    this.count = 0;
    this.sumX = 0;
    this.sumX2 = 0;
    this.sumXY = 0;
    this.sumY = 0;
}

LineFitter.prototype = {
    'add': function(x, y)
    {
        this.count++;
        this.sumX += x;
        this.sumX2 += x*x;
        this.sumXY += x*y;
        this.sumY += y;
    },
    'subtract': function(x, y)
    {
        this.count--;
        this.sumX -= x;
        this.sumX2 -= x*x;
        this.sumXY -= x*y;
        this.sumY -= y;
    },
    'project': function(x)
    {
        var det = this.count * this.sumX2 - this.sumX * this.sumX;
        var offset = (this.sumX2 * this.sumY - this.sumX * this.sumXY) / det;
        var scale = (this.count * this.sumXY - this.sumX * this.sumY) / det;
        return offset + x * scale;
    }
};
/*
function linearProject(data, x)
{
    var fitter = new LineFitter();
    for (var i = 0; i < data.length; i++)
    {
        fitter.add(i, data[i]);
    }
    return fitter.project(x);
}*/