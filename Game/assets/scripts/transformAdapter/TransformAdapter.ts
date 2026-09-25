import {
	_decorator,
	math,
	screen,
	v3,
	view,
	Component,
	Vec3,
	Enum,
	UITransform,
	Vec2,
	v2,
	CCFloat,
	v4,
	Vec4,
	CCBoolean,
	Canvas,
	Camera,
	BitMask,
} from "cc";

const { ccclass, property, requireComponent } = _decorator;

interface ResizeProps {
	relativePosition?: Vec3;
	absolutePosition?: Vec3;
	scale?: Vec3;
	anchor?: Vec2;
	padding?: Vec4;
}

const ASPECT_RATIO_TABLE_DEFAULT: number = 1.33;
const ASPECT_RATIO_BASE_DEFAULT: number = 1.73;
const ASPECT_RATIO_LONG_DEFAULT: number = 2;

let aspectRatioTablet: number = ASPECT_RATIO_TABLE_DEFAULT;
let aspectRatioBase: number = ASPECT_RATIO_BASE_DEFAULT;
let aspectRatioLong: number = ASPECT_RATIO_LONG_DEFAULT;

enum AspectRatioPreset {
	Table,
	Base,
	Long,
}

enum ResizeMode {
	None = 0,
	Position = 1 << 0,
	Scale = 1 << 1,
	Anchor = 1 << 2,
	Padding = 1 << 3,
	// 1 << 4 (EulerAngles) и 1 << 5 (Size) удалены; биты не переиспользуем,
	// чтобы не менять смысл resizeMode в уже сохранённых сценах.
}

const aspectRatioPresetMap = new Map<
	AspectRatioPreset,
	(aspectRatio: number) => boolean
>();

aspectRatioPresetMap.set(
	AspectRatioPreset.Table,
	(aspectRatio: number) =>
		aspectRatio >= aspectRatioTablet && aspectRatio < aspectRatioBase
);

aspectRatioPresetMap.set(
	AspectRatioPreset.Base,
	(aspectRatio: number) =>
		aspectRatio >= aspectRatioBase && aspectRatio < aspectRatioLong
);

aspectRatioPresetMap.set(
	AspectRatioPreset.Long,
	(aspectRatio: number) => aspectRatio >= aspectRatioLong
);

@ccclass("PositionProps")
class PositionProps {
	@property(Vec3) positionP: Vec3 = v3(0, 0, 0);
	@property(Vec3) positionL: Vec3 = v3(0, 0, 0);
	@property(CCBoolean) isRelative: boolean = true;
}

@ccclass("ScaleProps")
class ScaleProps {
	@property(Vec3) scaleP: Vec3 = v3(1, 1, 1);
	@property(Vec3) scaleL: Vec3 = v3(1, 1, 1);
	@property(CCBoolean) isRelative: boolean = false;
}

@ccclass("AnchorProps")
class AnchorProps {
	@property(Vec2) anchorP: Vec2 = v2(0.5, 0.5);
	@property(Vec2) anchorL: Vec2 = v2(0.5, 0.5);
}

@ccclass("PaddingProps")
class PaddingProps {
	@property(Vec4) paddingP: Vec4 = v4(0, 0, 0, 0);
	@property(Vec4) paddingL: Vec4 = v4(0, 0, 0, 0);
}

@ccclass("ResizePreset")
class ResizePreset {
	@property(CCBoolean) isAspectRatio: boolean = false;

	@property({
		type: Enum(AspectRatioPreset),
		visible() {
			return this.isAspectRatio;
		},
	})
	aspectRatio: number = AspectRatioPreset.Base;

	@property({
		type: CCFloat,
		visible() {
			return this.isAspectRatio && this.aspectRatio === AspectRatioPreset.Table;
		},
	})
	aspectRatioTable: number = ASPECT_RATIO_TABLE_DEFAULT;

	@property({
		type: CCFloat,
		visible() {
			return this.isAspectRatio && this.aspectRatio === AspectRatioPreset.Base;
		},
	})
	aspectRatioBase: number = ASPECT_RATIO_BASE_DEFAULT;

	@property({
		type: CCFloat,
		visible() {
			return this.isAspectRatio && this.aspectRatio === AspectRatioPreset.Long;
		},
	})
	aspectRatioLong: number = ASPECT_RATIO_LONG_DEFAULT;

	@property({ type: BitMask(ResizeMode) })
	resizeMode: number = ResizeMode.None;

	@property({
		type: PositionProps,
		visible() {
			return (this.resizeMode & ResizeMode.Position) !== 0;
		},
	})
	positionProps: PositionProps = null;

	@property({
		type: ScaleProps,
		visible() {
			return (this.resizeMode & ResizeMode.Scale) !== 0;
		},
	})
	scaleProps: ScaleProps = null;

	@property({
		type: AnchorProps,
		visible() {
			return (this.resizeMode & ResizeMode.Anchor) !== 0;
		},
	})
	anchorProps: AnchorProps = null;

	@property({
		type: PaddingProps,
		visible() {
			return (this.resizeMode & ResizeMode.Padding) !== 0;
		},
	})
	paddingProps: PaddingProps = null;
}

@ccclass("TransformAdapter")
@requireComponent(UITransform)
export class TransformAdapter extends Component {
	@property({ type: [ResizePreset] }) resizePresets: ResizePreset[] = [];

	currentResizeProps: ResizeProps;
	currentResizePreset: ResizePreset;
	isLandscape: boolean = false;

	private _transform: UITransform = null;
	private _transformParent: UITransform = null;
	private _currentPosition: Vec3 = v3();
	private _baseScale: Vec3 = v3(1, 1, 1);
	private _parentAdapter: TransformAdapter = null;
	private _camera: Camera = null;

	protected onDestroy() {
		this._handleSubscription(false);
	}

	protected onLoad() {
		this._transform = this.getComponent(UITransform);
		this._transformParent = this.node.parent?.getComponent(UITransform) ?? null;
		// Флаг «родитель adapter-managed»: включает раскладку от бокса родителя
		// и компенсацию его мирового скейла.
		this._parentAdapter = this.node.parent?.getComponent(TransformAdapter) ?? null;
		// Базовый (до padding) локальный масштаб ноды из редактора. Нужен, чтобы
		// padding считался от стабильной базы, когда у ноды нет Scale-пресета.
		this.node.getScale(this._baseScale);
		this._handleSubscription(true);
	}

	protected start() {
		this.onSizeChange();
	}

	public onSizeChange(): void {
		const { width, height }: math.Size = screen.resolution;
		this.isLandscape = width > height;

		const aspectRatio: number =
			Math.max(width, height) / Math.min(width, height);

		for (const preset of this.resizePresets) {
			preset.aspectRatioTable && (aspectRatioTablet = preset.aspectRatioTable);
			preset.aspectRatioBase && (aspectRatioBase = preset.aspectRatioBase);
			preset.aspectRatioLong && (aspectRatioLong = preset.aspectRatioLong);

			if (preset.isAspectRatio && !aspectRatioPresetMap.get(preset.aspectRatio)(aspectRatio)) {
				continue;
			}

			this.currentResizePreset = preset;

			this.currentResizeProps = {
				relativePosition: this._calculateRelativePosition(),
				absolutePosition: this._calculateAbsolutePosition(),
				scale: this._calculateScale(),
				anchor: this._calculateAnchor(),
				padding: this._calculatePadding(),
			};

			this._setRelativePosition();
			this._setAbsolutePosition();
			this._setScale();
			this._setAnchor();
			this._setPadding();
		}
	}

	private _handleSubscription(active: boolean) {
		const func: string = active ? "on" : "off";

		view[func]("canvas-resize", this.onSizeChange, this);
	}

	private _setRelativePosition() {
		if ((this.currentResizePreset.resizeMode & ResizeMode.Position) === 0) {
			return;
		}
		if (this.currentResizeProps.relativePosition !== null) {
			const relativePosition: Vec3 = this._getRelativePosition(
				this.currentResizeProps.relativePosition
			);
			this._currentPosition = relativePosition;
			this.node.setPosition(relativePosition);
		}
	}

	private _setAbsolutePosition() {
		if ((this.currentResizePreset.resizeMode & ResizeMode.Position) === 0) {
			return;
		}
		if (this.currentResizeProps.absolutePosition !== null) {
			this._currentPosition = this.currentResizeProps.absolutePosition;
			this.node.setPosition(this.currentResizeProps.absolutePosition);
		}
	}

	private _setScale() {
		const hasScalePreset: boolean =
			(this.currentResizePreset.resizeMode & ResizeMode.Scale) !== 0 &&
			this.currentResizeProps.scale !== null;
		// Без явного скейла и не под adapter-родителем масштаб не трогаем —
		// нода наследует масштаб родителя, как раньше.
		if (!hasScalePreset && this._parentAdapter === null) {
			return;
		}
		const scale: Vec3 = this._getBaseLocalScale();
		this.node.setScale(scale.x, scale.y);
	}

	private _getBaseLocalScale(): Vec3 {
		// Явный Scale-пресет определяет масштаб: absolute уже компенсирует
		// родителя в _getScale, relative намеренно тянется вместе с ним.
		const scale = this.currentResizeProps.scale;
		if ((this.currentResizePreset.resizeMode & ResizeMode.Scale) !== 0 && scale) {
			return scale;
		}
		// Нода под adapter-родителем без явного скейла — компенсируем мировой
		// масштаб родителя, чтобы сохранить авторский размер (world scale =
		// редакторный scale) и не растягиваться вместе с родителем.
		if (this._parentAdapter !== null && this.node.parent) {
			const parentScale: Vec3 = this.node.parent.getWorldScale();
			return v3(
				this._baseScale.x / parentScale.x,
				this._baseScale.y / parentScale.y,
				this._baseScale.z
			);
		}
		// Иначе — авторский масштаб без компенсации.
		return this._baseScale;
	}

	private _setAnchor() {
		if ((this.currentResizePreset.resizeMode & ResizeMode.Anchor) === 0) {
			return;
		}
		if (this.currentResizeProps.anchor !== null) {
			this._transform.anchorX = this.currentResizeProps.anchor.x;
			this._transform.anchorY = this.currentResizeProps.anchor.y;
		}
	}

	private _setPadding() {
		if ((this.currentResizePreset.resizeMode & ResizeMode.Padding) === 0) {
			return;
		}
		if (this.currentResizeProps.padding !== null) {
			const padding = this.currentResizeProps.padding;

			if (padding.x < 0 || padding.y < 0 || padding.z < 0 || padding.w < 0) {
				console.warn("Values of padding should be positive number");
				return;
			}

			const parentScale: Vec3 = this.node.parent
				? this.node.parent.getWorldScale()
				: v3(1, 1, 1);

			// База — масштаб ДО padding (та же логика, что в _setScale): Scale-
			// пресет, либо компенсация под adapter-родителем, либо редакторный
			// масштаб. Берём её, а не getWorldScale(), иначе padding
			// накапливался бы каждый кадр.
			const baseScale: Vec3 = this._getBaseLocalScale();

			const baseWidth: number =
				parentScale.x * baseScale.x * this._transform.width;
			const baseHeight: number =
				parentScale.y * baseScale.y * this._transform.height;

			const effectiveWidth =
				padding.x + padding.z <= baseWidth
					? baseWidth - (padding.x + padding.z)
					: 0;
			const effectiveHeight =
				padding.y + padding.w <= baseHeight
					? baseHeight - (padding.y + padding.w)
					: 0;

			this.node.setScale(
				effectiveWidth / this._transform.width / parentScale.x,
				effectiveHeight / this._transform.height / parentScale.y
			);

			// Сдвиг пивота с учётом anchor, чтобы padding давал реальный отступ
			// от краёв, а не просто ужимал ноду на месте. При anchor 0.5 сводится
			// к (x - z)/2; при якоре у края толкает ноду внутрь на величину padding.
			const anchorX: number = this._transform.anchorX;
			const anchorY: number = this._transform.anchorY;
			const shiftX: number = padding.x * (1 - anchorX) - padding.z * anchorX;
			const shiftY: number = padding.y * (1 - anchorY) - padding.w * anchorY;

			this.node.setPosition(
				this._currentPosition.x + shiftX / parentScale.x,
				this._currentPosition.y + shiftY / parentScale.y
			);
		}
	}

	private _getParentSize(): math.Size {
		const camera: Camera = this._getRenderCamera();
		
		if (camera && camera.projection === Camera.ProjectionType.ORTHO) {
			const { width, height }: math.Size = screen.resolution;
			const visibleHeight: number = 2 * camera.orthoHeight;
			return new math.Size(visibleHeight * (width / height), visibleHeight);
		}

		if (this._transformParent) {
			return new math.Size(this._transformParent.width, this._transformParent.height);
		}

		const { width, height }: math.Size = screen.resolution;
		return new math.Size(width / view.getScaleX(), height / view.getScaleY());
	}

	private _getRenderCamera(): Camera {
		if (this._camera) {
			return this._camera;
		}
		let node = this.node;
		while (node) {
			const canvas: Canvas = node.getComponent(Canvas);
			if (canvas && canvas.cameraComponent) {
				this._camera = canvas.cameraComponent;
				break;
			}
			node = node.parent;
		}
		return this._camera;
	}

	private _getRelativePosition(relativePosition: Vec3): Vec3 {
		// Бокс родителя как систему раскладки берём только когда родитель сам
		// adapter-managed: тогда его UITransform — это раскладочный бокс, а
		// мировой скейл родителя сам положит локальную позицию на края
		// визуального (отскейленного) бокса. Иначе (top-level / обычный
		// контейнер) считаем от экрана/камеры, как раньше.
		const useParentBox: boolean =
			this._parentAdapter !== null && this._transformParent !== null;
		const { width, height }: math.Size = useParentBox
			? new math.Size(this._transformParent.width, this._transformParent.height)
			: this._getParentSize();
		const anchorPoint: Vec2 =
			this._transformParent?.anchorPoint ?? v2(0.5, 0.5);

		const originX = width * (0.5 - anchorPoint.x);
		const originY = height * (0.5 - anchorPoint.y);

		return v3(
			originX + width * relativePosition.x - width / 2,
			originY + height / 2 - height * relativePosition.y,
			0
		);
	}

	private _calculateRelativePosition() {
		const props = this.currentResizePreset.positionProps;
		return props && props.isRelative
			? props[this.isLandscape ? "positionL" : "positionP"]
			: null;
	}

	private _calculateAbsolutePosition() {
		const props = this.currentResizePreset.positionProps;
		return props && !props.isRelative
			? props[this.isLandscape ? "positionL" : "positionP"]
			: null;
	}

	private _calculateScale() {
		const props = this.currentResizePreset.scaleProps;
		if (!props) {
			return null;
		}
		const preset: Vec3 = props[this.isLandscape ? "scaleL" : "scaleP"];

		if (props.isRelative) {
			// Под adapter-родителем тянемся по его боксу (UITransform), а не по
			// экрану: мировой скейл родителя сокращается, ребёнок заполняет
			// визуальный бокс родителя. Иначе — относительно экрана/камеры.
			const parentSize: math.Size =
				this._parentAdapter !== null && this._transformParent !== null
					? new math.Size(this._transformParent.width, this._transformParent.height)
					: this._getParentSize();
			return v3(
				(parentSize.width * preset.x) / this._transform.width,
				(parentSize.height * preset.y) / this._transform.height,
				0
			);
		}
		const scale: Vec2 = this._getScale(preset);
		return v3(scale.x, scale.y, preset.z);
	}

	private _calculateAnchor() {
		const props = this.currentResizePreset.anchorProps;
		return props ? props[this.isLandscape ? "anchorL" : "anchorP"] : null;
	}

	private _calculatePadding() {
		const props = this.currentResizePreset.paddingProps;
		return props ? props[this.isLandscape ? "paddingL" : "paddingP"] : null;
	}

	private _getScale(presetScale: Vec3) {
		if (!this._transformParent) {
			return v2(presetScale.x, presetScale.y);
		}
		const parentWorldScale: Vec3 = this.node.parent.getWorldScale();
		return v2(presetScale.x / parentWorldScale.x, presetScale.y / parentWorldScale.y);
	}
}
