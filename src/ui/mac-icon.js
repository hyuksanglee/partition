// Build a Dock-sized variant without changing the marketplace artwork.
ObjC.import('Cocoa');

function run(argv) {
  const [source, destination] = argv;
  const image = $.NSImage.alloc.initWithContentsOfFile($(source));
  if (image.isNil() || !image.isValid) throw new Error('Invalid Partition icon.');
  const size = 1024;
  const inset = 100;
  const bitmap = $.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(
    null, size, size, 8, 4, true, false, $.NSCalibratedRGBColorSpace, 0, 0,
  );
  $.NSGraphicsContext.saveGraphicsState;
  $.NSGraphicsContext.setCurrentContext($.NSGraphicsContext.graphicsContextWithBitmapImageRep(bitmap));
  $.NSGraphicsContext.currentContext.imageInterpolation = 3; // High quality.
  $.NSColor.clearColor.set;
  $.NSRectFillUsingOperation($.NSMakeRect(0, 0, size, size), 0); // Clear to transparent.
  image.drawInRectFromRectOperationFraction(
    $.NSMakeRect(inset, inset, size - inset * 2, size - inset * 2), $.NSMakeRect(0, 0, image.size.width, image.size.height), 2, 1,
  );
  $.NSGraphicsContext.currentContext.flushGraphics;
  $.NSGraphicsContext.restoreGraphicsState;
  const data = bitmap.representationUsingTypeProperties(4 /* PNG */, $({}));
  if (!data.writeToFileAtomically($(destination), true)) throw new Error('Could not write Partition Dock icon.');
}
