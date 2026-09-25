const fs = require("fs");
const JSZip = require("jszip");
const path = require("path");

const al = ["./buildes/AL/index.html"];
const un = ["./buildes/UN/index.html"];
const vu = ["./buildes/VU/ad.html"];
const fb = ["./buildes/FB/index.html", "./buildes/FB/bundle.js"];
const mtg = ["./buildes/MW/index.html"];
const ggn = ["./buildes/GA_LI/index.html"];
const ggl = ["./buildes/GA_PI/index.html"];
const mlc = ["./buildes/MC/index.html"];
const tk = ["./buildes/TK/index.html", "./buildes/TK/config.json"];
const lf = ["./buildes/LF/index.html"];

const zipDir = "./buildes/zip/";

const Name = "toh_playable023_";
const Size = "4.9mb";
const Props = "en_noa";
const PropsAl = "en_yes";

const al_name = "apl";
const un_name = "uni";
const vu_name = "vgl";
const fb_name = "fcb";
const mtg_name = "mtg";
const ggn_name = "ggn";
const ggl_name = "ggl";
const mlc_name = "mlc";
const tk_name = "ttk";
const lf_name = "lf";

const targets = [
	[al, [Name, al_name, PropsAl, Size].join("_"), false, true],
	[un, [Name, un_name, Props, Size].join("_"), false, true],
	[vu, [Name, vu_name, Props, Size].join("_"), true, false],
	[fb, [Name, fb_name, Props, Size].join("_"), true, false],
	[mtg, [Name, mtg_name, Props, Size].join("_"), true, false],
	[ggn, [Name, ggn_name, Props, Size].join("_"), true, false],
	[ggl, [Name, ggl_name, Props, Size].join("_"), true, false],
	[mlc, [Name, mlc_name, Props, Size].join("_"), true, false],
	[tk, [Name, tk_name, Props, Size].join("_"), true, false],
	[lf, [Name, lf_name, Props, Size].join("_"), false, true],
];

async function zip(srcs, name, isZip, isRename) {
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
	let folderDir = zipDir + "/";

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
