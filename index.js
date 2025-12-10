const SnapcastClient = require("snapcast-client");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

const volumes = {
	desk: {
		loud: 100,
		normal: 100,
		quiet: 50,
	},
	storage: {
		loud: 23,
		normal: 18,
		quiet: 10,
	},
	bedroom: {
		loud: 50,
		normal: 35,
		quiet: 26,
	},
	shower: {
		loud: 45,
		normal: 30,
		quiet: 22,
	},
	lounge: {
		loud: 52,
		normal: 36,
		quiet: 24,
	},
	kitchen: {
		loud: 42,
		normal: 30,
		quiet: 18,
	},
};

async function main(argv) {
	yargs(hideBin(process.argv))
		.usage("Set some volume presets.")
		.option("h", {
			alias: "host",
			default: "localhost",
			requiresArg: true,
		})
		.option("p", {
			alias: "port",
			default: 1705,
			number: true,
			requiresArg: true,
		})
		.option("g", {
			alias: "group",
			requiresArg: true,
			description: "A particular group to apply the volume change to.",
		})
		.option("o", {
			alias: "others",
			default: "auto",
			choices: ["auto", "loud", "normal", "quiet"],
			description: "Volume to apply to clients not in `group`.",
		})
		.command(["auto", "$0"], "make it normal or quiet depending on what time it is", {}, (options) => run("auto", options))
		.command("loud", "make it loud", {}, (options) => run("loud", options))
		.command("normal", "make it a normal volume", {}, (options) => run("loud", options))
		.command("quiet", "make it quiet", {}, (options) => run("quiet", options))
		.demandCommand(1, 1)
		.parse();
}

async function run(command, options) {
	const client = new SnapcastClient({
		host: options.host,
		port: options.port,
	});

	client.on("message", (message) => {
		logger.log("got a message:", message);
	});

	await client.connect();

	const groups = await client.getGroups();
	const clients = groups.flatMap((group) => group.clients);
	function getGroupByName(name) {
		const group = groups.find((group) => group.name.toLowerCase() === name.toLowerCase());
		if (group == null) throw new Error(`Couldn't find group "${name}". Is there a typo? Did its name change?`);
		return group;
	}
	function getClientByName(name) {
		const client = clients.find((client) => client.config.name.toLowerCase() === name.toLowerCase());
		if (client == null) throw new Error(`Couldn't find client "${name}". Did its name change?`);
		return client;
	}

	let exitCode = 0;

	try {
		const clientIds = {
			desk: getClientByName("desk").id,
			storage: getClientByName("storage").id,
			bedroom: getClientByName("bedroom").id,
			shower: getClientByName("shower").id,
			lounge: getClientByName("lounge").id,
			kitchen: getClientByName("kitchen").id,
		};
		const clientVolumes = Object.entries(clientIds).reduce((acc, [name, id]) => ({
			...acc,
			[id]: volumes[name],
		}), {});
		const clientIdsArray = [...Object.values(clientIds)];

		const hour = new Date().getHours();
		const autoVolume = (hour < 9 || hour >= 22) ? "quiet" : "normal";

		const volume = command === "auto" ? autoVolume : command;
		const otherVolume = options.others === "auto" ? autoVolume : options.others;

		const group = options.group ? getGroupByName(options.group) : null;
		const clientsInGroup = group ? clientIdsArray.filter((id) => group.clients.some((client) => client.id === id)) : clientIdsArray;
		const otherClients = clientIdsArray.filter((id) => !clientsInGroup.includes(id));

		await Promise.all([
			...clientsInGroup.map((id) => client.setVolume(id, clientVolumes[id][volume])),
			...otherClients.map((id) => client.setVolume(id, clientVolumes[id][otherVolume])),
		]);
	} catch (error) {
		console.error(error.message);
		exitCode = 1;
	} finally {
		await client.close();
	}
	process.exit(exitCode);
}

main(process.argv);
