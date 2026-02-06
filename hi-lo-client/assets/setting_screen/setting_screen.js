
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class setting_screen extends Phaser.Scene {

	constructor() {
		super("setting_screen");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @returns {void} */
	editorCreate() {

		// setting_bg
		this.add.image(544, 1111, "setting_bg");

		// setting_box
		this.add.image(544, 935, "setting_box");

		// setting_box_1
		this.add.image(544, 1132, "setting_box");

		// setting_box_2
		this.add.image(544, 1331, "setting_box");

		// setting_off
		this.add.image(922, 806, "setting_off");

		// check_box
		this.add.image(818, 936, "check_box");

		// check_box2
		this.add.image(818, 1132, "check_box2");

		// setting_language
		const setting_language = this.add.image(711, 1330, "setting_language");
		setting_language.scaleX = 1.2;

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */

	// Write your code here

	create() {

		this.editorCreate();
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
