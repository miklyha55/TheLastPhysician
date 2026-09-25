const fs = require("fs");
const JSZip = require("jszip");
const path = require("path");

const al = ["./buildes/AL/index.html"];
const un = ["./buildes/UN/index.html"];
const vu = ["./buildes/VU/ad.html"];
const fb = ["./buildes/FB/index.html", "./buildes/FB/bundle.js"];
const mw = ["./buildes/MW/index.html"];
const mc = ["./buildes/MC/index.html"];
const lf = ["./buildes/LF/index.html"];
const gaL = ["./buildes/GA_LI/index.html"];
const gaP = ["./buildes/GA_PI/index.html"];
const tk = ["./buildes/TK/index.html", "./buildes/TK/config.json"];

const zipDir = "./buildes/zip/";

const Name = "playable_name";

const al_name = "applovin";
const un_name = "unity";
const vu_name = "vungle";
const fb_name = "facebook";
const mv_name = "mintegral";
const mc_name = "moloco";
const lf_name = "liftoff";
const ga_name_l = "googleLS";
const ga_name_p = "googlePR";
const tk_name = "tikTok";

const targets = [
	[al, Name, [Name, al_name].join("_"), false, true],
	[un, Name, [Name, un_name].join("_"), false, true],
	[vu, Name, [Name, vu_name].join("_"), true, false],
	[fb, Name, [Name, fb_name].join("_"), true, false],
	[mw, Name, [Name, mv_name].join("_"), true, false],
	[mc, Name, [Name, mc_name].join("_"), false, true],
	[lf, Name, [Name, lf_name].join("_"), true, false],
	[gaL, Name, [Name, ga_name_l].join("_"), true, false],
	[gaP, Name, [Name, ga_name_p].join("_"), true, false],
	[tk, [Name, tk_name].join("_"), [Name, tk_name].join("_"), true, false],
];

async function zip(srcs, name, folder, isZip, isRename) {
	let contents = [];

	srcs.forEach((src) => {
		contents.push([src, fs.readFileSync(src, { encoding: "utf-8" })]);
	});

	let zip = new JSZip();
	contents.forEach((content, index) => {
		var zipName =
			index === 0 && isRename
				? name + path.extname(path.basename(content[0]))
				: path.basename(content[0]);
		zip.file(zipName, content[1]);
	});
	let zipped = await zip.generateAsync({ type: "uint8array" });
	let folderDir = zipDir + folder + "/";

	fs.mkdirSync(zipDir, { recursive: true });
	fs.mkdirSync(folderDir, { recursive: true });

	if (isZip) {
		fs.writeFileSync(folderDir + name + ".zip", zipped);
	} else {
		fs.copyFileSync(srcs[0], folderDir + name + ".html");
	}
}

function main() {
	targets.forEach((z) => zip(z[0], z[1], z[2], z[3], z[4]));
}

main();
