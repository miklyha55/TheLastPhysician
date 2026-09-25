import { Node, tween, TweenEasing, Vec3 } from "cc";

class BezierCurves {
  public static quadratic(
    target: Node,
    controlPoint: Vec3,
    endPoint: Vec3,
    duration: number,
    callback: () => void = () => {},
    delay: number = 0,
    easing: TweenEasing = "linear"
  ) {
    const quadratic = (
      start: number,
      control: number,
      end: number,
      t: number
    ): number => {
      return (
        (1 - t) * (1 - t) * start + 2 * (1 - t) * t * control + t * t * end
      );
    };

    const coordinates: Array<
      (start: number, end: number, ratio: number) => any
    > = [
      (start, end, ratio) => quadratic(start, controlPoint.x, end, ratio),
      (start, end, ratio) => quadratic(start, controlPoint.y, end, ratio),
      (start, end, ratio) => quadratic(start, controlPoint.z, end, ratio),
    ];

    let counter = 0;

    tween(target)
      .delay(delay)
      .to(
        duration,
        { worldPosition: endPoint },
        {
          progress: (start, end, dummy, ratio) => {
            const coordinate = coordinates[counter](start, end, ratio);
            counter = (counter + 1) % 3;
            return coordinate;
          },
          easing,
        }
      )
      .call(callback)
      .start();
  }

  public static cubic(
    target: Node,
    controlPoint0: Vec3,
    controlPoint1: Vec3,
    endPoint: Vec3,
    duration: number,
    callback: () => void = () => {},
    delay: number = 0,
    easing: TweenEasing = "linear"
  ) {
    const cubic = (
      start: number,
      control0: number,
      control1: number,
      end: number,
      t: number
    ): number => {
      return (
        (1 - t) * (1 - t) * (1 - t) * start +
        3 * (1 - t) * (1 - t) * t * control0 +
        3 * (1 - t) * t * t * control1 +
        t * t * t * end
      );
    };

    const coordinates: Array<
      (start: number, end: number, ratio: number) => any
    > = [
      (start, end, ratio) =>
        cubic(start, controlPoint0.x, controlPoint1.x, end, ratio),
      (start, end, ratio) =>
        cubic(start, controlPoint0.y, controlPoint1.y, end, ratio),
      (start, end, ratio) =>
        cubic(start, controlPoint0.z, controlPoint1.z, end, ratio),
    ];

    let counter = 0;

    tween(target)
      .delay(delay)
      .to(
        duration,
        { worldPosition: endPoint },
        {
          progress: (start, end, dummy, ratio) => {
            const coordinate = coordinates[counter](start, end, ratio);
            counter = (counter + 1) % 3;
            return coordinate;
          },
          easing,
        }
      )
      .call(callback)
      .start();
  }
}

export default BezierCurves;
