var fs = require("fs");
var zlib = require("zlib");

function getResData(htmlUrl) {
    html = fs.readFileSync(htmlUrl, "utf8");
    
    const quotedPattern = /window\.__adapter_zip__="([^"]*)"/;
    const quotedMatch = html.match(quotedPattern);
    const zipData = Buffer.from(quotedMatch[1], 'base64');
    const decompressed = zlib.inflateSync(zipData, { to: 'string' });
    const resData = decompressed.toString();

    return resData;
}

module.exports = {
    getResData: getResData,
};
