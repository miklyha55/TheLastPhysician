var fs = require("fs");
var uglify = require("uglify-js");
const path = require("path");
var cleanCSS = require("clean-css");
var base122 = require("./base122");
const { getResData } = require("./utils");
const networkConfigs = require("./networkConfigs");

var splashFolderName = "splash-screen-1";
var sourceFileName = "single-file-3x.html";
var sourceFileNameBase122 = "single-file-3x-base122.html";

var iosLink = null;
var androidLink = null;

const PROJECT_ROOT = __dirname;
const COCOS_BUILD_DIR = path.join(PROJECT_ROOT, "../build");

const initialHtmlPath = path.join(COCOS_BUILD_DIR, sourceFileName);
const outputHtmlPath = path.join(COCOS_BUILD_DIR, sourceFileNameBase122);

const BUILDER_DIR = path.join(PROJECT_ROOT);
const FINAL_BUILDES_DIR = path.join(PROJECT_ROOT, "../buildes");

async function build() {
	for (const key in networkConfigs) {
		if (!Object.prototype.hasOwnProperty.call(networkConfigs, key)) continue;

		const networkConfig = networkConfigs[key];

		fillStoreLinks(networkConfig);
		injectDecoder(networkConfig);
		repackAssetsToBase122(networkConfig);

		await generateAdNetworksBuilds([key]);
	}
}

build();

async function generateAdNetworksBuilds(selectedNetworks) {
	if (!fs.existsSync(COCOS_BUILD_DIR)) {
		console.log("no initial build found!");
		return;
	}
	if (!fs.existsSync(FINAL_BUILDES_DIR)) {
		fs.mkdirSync(FINAL_BUILDES_DIR);
	}
	for (const networkName of selectedNetworks) {
		const config = networkConfigs[networkName];
		if (!config) return;
		const networkPath = path.join(FINAL_BUILDES_DIR, config.nameCode);
		if (!fs.existsSync(networkPath)) {
			fs.mkdirSync(networkPath);
		}
		const head =
			typeof config.headScript === "function"
				? config.headScript({ iosLink, androidLink })
				: config.headScript;

		do_task(
			path.join(
				networkPath,
				config.nameFile != null ? config.nameFile : "index.html",
			),
			config.apiScriptName,
			head,
			config.isSeparateJs,
		);
		if (config.jsonConfig) {
			create_json_config(
				path.join(networkPath, "config.json"),
				config.jsonConfig,
			);
		}
	}
}

function fillStoreLinks() {
	const data = getResData(initialHtmlPath);
	const iosPatternLocal =
		/https:\/\/apps\.apple\.com\/[a-z]{2}\/app\/[^\s"']+?(?=\\|"|'|\s|$)/g;
	const iosPattern =
		/https:\/\/apps\.apple\.com\/app\/[^\s"']+?(?=\\|"|'|\s|$)/g;
	const androidPattern =
		/https:\/\/play\.google\.com\/store\/apps\/details\?id=[^\s"']+?(?=\\|"|'|\s|$)/g;

	const iosUrlMatches = data.match(iosPattern)
		? data.match(iosPattern)
		: data.match(iosPatternLocal);
	const androidUrlMatches = data.match(androidPattern);

	iosLink = iosUrlMatches ? iosUrlMatches[0] : null;
	androidLink = androidUrlMatches ? androidUrlMatches[0] : null;

	const colorDanger = "\x1b[31m%s\x1b[0m";
	const colorAccept = "\x1b[32m%s\x1b[0m";

	if (!iosLink && !androidLink) {
		console.warn(colorDanger, "STORE LINKS EMPTY!!!");
	} else if (iosLink && !androidLink) {
		console.warn(colorDanger, "ANDROID STORE MISSING! DOUBLE CHECK!");
		androidLink = iosLink;
	} else if (androidLink && !iosLink) {
		console.warn(colorDanger, "IOS STORE MISSING! DOUBLE CHECK!");
		iosLink = androidLink;
	}
	console.warn(
		iosLink && androidLink ? colorAccept : colorDanger,
		`IOS STORE: ${iosLink}, ANDROID STORE: ${androidLink}`,
	);
}

function injectDecoder() {
	let html = fs.readFileSync(initialHtmlPath, "utf8");
	const decodeFunc = get_code_by_js_file(
		path.join(__dirname, "b122Decoder.js"),
	);
	const injectionPoint = '<script data-id="adapter-plugins">';
	html = html.replace(injectionPoint, `${decodeFunc}${injectionPoint}`);
	fs.writeFileSync(outputHtmlPath, html);
}

function repackAssetsToBase122() {
	const originalHtml = fs.readFileSync(outputHtmlPath);
	const htmlString = originalHtml.toString("utf8");
	const dataStartsWith = 'window.__adapter_zip__="';
	const dataStartIndex =
		htmlString.indexOf(dataStartsWith) + dataStartsWith.length;
	const dataEndIndex = htmlString.indexOf('"', dataStartIndex);
	const base64Data = htmlString.slice(dataStartIndex, dataEndIndex);
	const base122Data = base122.encodeFromBase64(base64Data);
	console.log(
		`Compressed from ${base64Data.length} to => ${base122Data.length} bytes`,
	);
	const optimizedHtml = Buffer.concat([
		originalHtml.slice(0, dataStartIndex),
		Buffer.from(base122Data, "binary"),
		originalHtml.slice(dataEndIndex),
	]);
	fs.writeFileSync(outputHtmlPath, optimizedHtml);
}

function get_file_content(filepath) {
	let file = fs.readFileSync(filepath);
	return file.toString();
}

function get_code_by_js_file(js_filepath) {
	let js = get_file_content(js_filepath);
	let min_js = uglify.minify(js).code;
	return `<script type="text/javascript">${min_js}</script>`;
}

function get_code_by_css_file(css_filepath) {
	let css = get_file_content(css_filepath);
	let min_css = new cleanCSS().minify(css).styles;
	return `<style>${min_css}</style>`;
}

function create_json_config(output, value) {
	var json = JSON.stringify(value);
	fs.writeFileSync(output, json);
}

function extractBundleFromHtml(htmlContent, outputDir) {
	const dataStartsWith = 'window.__adapter_zip__="';
	const dataStartIndex = htmlContent.indexOf(dataStartsWith);
	if (dataStartIndex === -1) {
		console.error("Could not find game bundle in HTML");
		return htmlContent;
	}
	const scriptStart = htmlContent.lastIndexOf("<script", dataStartIndex);
	if (scriptStart === -1) {
		console.error("Could not find script tag for game bundle");
		return htmlContent;
	}
	const scriptEnd = htmlContent.indexOf("</script>", dataStartIndex);
	if (scriptEnd === -1) {
		console.error("Could not find end of script tag");
		return htmlContent;
	}
	const scriptContentStart = htmlContent.indexOf(">", scriptStart) + 1;
	const jsContent = htmlContent.slice(scriptContentStart, scriptEnd).trim();
	const fullScriptTag = htmlContent.slice(
		scriptStart,
		scriptEnd + "</script>".length,
	);
	const replacementScript = '<script charset="utf-8" src="bundle.js"></script>';
	const modifiedHtml = htmlContent.replace(fullScriptTag, replacementScript);
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}
	const bundlePath = path.join(outputDir, "bundle.js");
	fs.writeFileSync(bundlePath, jsContent);
	return modifiedHtml;
}

async function do_task(
	outputHtml,
	scriptName,
	head = "",
	isSeparateJs = false,
) {
	let html = get_file_content(
		path.join(COCOS_BUILD_DIR, sourceFileNameBase122),
	);
	let splash = get_file_content(
		path.join(BUILDER_DIR, splashFolderName, "index.html"),
	);
	console.log("js, css - " + scriptName);
	html = html.replace(
		/<\/head>/,
		`${get_code_by_css_file(
			path.join(BUILDER_DIR, splashFolderName, "style.css"),
		)}\n</head>`,
	);
	html = html.replace(
		"</body>",
		() => `${get_code_by_js_file(
			path.join(BUILDER_DIR, "api", scriptName + ".js"),
		)}\n
        ${splash}</body>`,
	);
	html = html.replace("</head>", () => `${head}\n</head>`);
	html = html.replace(
		"</head>",
		() =>
			`<script>var iosLink = "${iosLink}"; var androidLink = "${androidLink}";</script>\n</head>`,
	);
	html = html.replace(
		"</head>",
		() =>
			`<script>const onDOMReady=()=>{const progress=document.querySelector('.progress-bar');const timeStamp=Date.now();const dProgress=0.06;const increaseProgress=()=>{const dt=Date.now()-timeStamp;progress.value=dt*dProgress+10;if(progress.value<100){requestAnimationFrame(increaseProgress);}};requestAnimationFrame(increaseProgress);};document.addEventListener('DOMContentLoaded', onDOMReady);</script>\n</head>`,
	);
	if (isSeparateJs) {
		html = extractBundleFromHtml(html, path.dirname(outputHtml));
	}
	fs.writeFileSync(outputHtml, html);
}
