import { Enum } from "cc";

const InputDirection = Enum({
	None: 0,
	Custom: 10,
	Redirect: 20,
	RedirectWithCounter: 30,
});

export default InputDirection;
