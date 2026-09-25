const fs = require("fs");
const JSZip = require("jszip");
const path = require("path");

const al = ["./buildes/AL/index.html"];
const un = ["./buildes/UN/index.html"];
const vu = ["./buildes/VU/ad.html"];
const fb = ["./buildes/FB/index.html", "./buildes/FB/bundle.js"];
const mw = ["./buildes/MW/index.html"];
const ga = ["./buildes/GA/index.html"];
const mc = ["./buildes/MC/index.html"];

const zipDir = "./buildes/zip/";

const Name = "playable_name";
const Lang = "EN";

const al_name = "Applovin";
const un_name = "Unity";
const vu_name = "Vungle";
const fb_name = "Facebook";
const mv_name = "Mintegral";
const ga_name = "Google";
const mc_name = "Moloco";

const targets = [
	[al, [Name, al_name, Lang].join("_"), al_name, false, true],
	[un, [Name, un_name, Lang].join("_"), un_name, false, true],
	[vu, [Name, vu_name, Lang].join("_"), vu_name, false, true],
	[fb, [Name, fb_name, Lang].join("_"), fb_name, true, false],
	[mw, [Name, mv_name, Lang].join("_"), mv_name, true, true],
	[ga, [Name, ga_name, Lang].join("_"), ga_name, true, false],
	[mc, [Name, mc_name, Lang].join("_"), mc_name, false, true],
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
