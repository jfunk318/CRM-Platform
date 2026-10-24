declare module "imagetracerjs" {
  type Rgba = { r: number; g: number; b: number; a: number };
  type ImageDataLike = { width: number; height: number; data: Uint8ClampedArray };
  const ImageTracer: {
    imagedataToSVG(imgd: ImageDataLike, options?: Record<string, unknown> & { pal?: Rgba[] }): string;
  };
  export default ImageTracer;
}
