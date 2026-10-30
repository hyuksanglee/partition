// macOS 기본 WebKit으로 주소창 없는 작은 창을 띄운다(설치 필요 없음).
// Compiled into Partition.app by mac-app.mjs; arguments follow its executable.
// 창을 닫으면 이 프로세스가 끝나고, 서버도 따라 종료된다.
ObjC.import('Cocoa');
ObjC.import('WebKit');

function menu(title, items) {
  const item = $.NSMenuItem.alloc.init;
  const m = $.NSMenu.alloc.initWithTitle($(title));
  items.forEach(([label, action, key]) => m.addItemWithTitleActionKeyEquivalent($(label), action, $(key)));
  item.submenu = m;
  return item;
}

function run(argv) {
  // Compiled JXA applets receive their CLI arguments through NSProcessInfo.
  const applet = !Array.isArray(argv);
  if (applet) argv = ObjC.deepUnwrap($.NSProcessInfo.processInfo.arguments).slice(1);
  const [url, title = 'Partition', w = '640', h = '600', iconPath] = argv;
  $.NSProcessInfo.processInfo.processName = $(title);
  const app = $.NSApplication.sharedApplication;
  let hasPartitionIcon = false;
  // Claude와 Codex 모두 같은 Partition 아이콘을 사용한다.
  // Dock에 등록하기 전에 적용해 osascript의 기본 exec 아이콘을 대체한다.
  if (iconPath) {
    const icon = $.NSImage.alloc.initWithContentsOfFile($(iconPath));
    if (!icon.isNil() && icon.isValid) { app.applicationIconImage = icon; hasPartitionIcon = true; }
  }
  app.setActivationPolicy(0); // Regular: Dock에 보이고 앞으로 나올 수 있음

  // 단축키(복사·붙여넣기·닫기·종료)가 동작하려면 메뉴가 있어야 한다.
  const main = $.NSMenu.alloc.init;
  main.addItem(menu('Partition', [['Quit Partition', 'terminate:', 'q']]));
  main.addItem(
    menu('Edit', [
      ['Undo', 'undo:', 'z'],
      ['Redo', 'redo:', 'Z'],
      ['Cut', 'cut:', 'x'],
      ['Copy', 'copy:', 'c'],
      ['Paste', 'paste:', 'v'],
      ['Select All', 'selectAll:', 'a'],
    ]),
  );
  main.addItem(menu('Window', [['Close', 'performClose:', 'w']]));
  app.mainMenu = main;

  const rect = $.NSMakeRect(0, 0, Number(w), Number(h));
  // JXA에서는 enum 상수가 안 잡힐 수 있어 숫자로 쓴다.
  const style = 1 | 2 | 4 | 8; // titled | closable | miniaturizable | resizable
  const win = $.NSWindow.alloc.initWithContentRectStyleMaskBackingDefer(rect, style, 2 /* buffered */, false);
  win.title = $(title);
  win.minSize = $.NSMakeSize(520, 480);
  win.releasedWhenClosed = false;

  const web = $.WKWebView.alloc.initWithFrameConfiguration(rect, $.WKWebViewConfiguration.alloc.init);
  web.autoresizingMask = 2 | 16; // 폭·높이 따라 늘어남
  win.contentView = web;
  web.loadRequest($.NSURLRequest.requestWithURL($.NSURL.URLWithString($(url))));

  ObjC.registerSubclass({
    name: 'PartitionWindowDelegate',
    protocols: ['NSWindowDelegate'],
    methods: {
      'windowWillClose:': {
        types: ['void', ['id']],
        implementation: () => $.NSApplication.sharedApplication.terminate(null),
      },
    },
  });
  // delegate는 약한 참조라, run이 끝난 뒤에도 사라지지 않게 전역에 붙잡아 둔다.
  globalThis.partitionKeep = [win, web, $.PartitionWindowDelegate.alloc.init];
  win.delegate = globalThis.partitionKeep[2];

  // 지금 마우스가 있는 화면 가운데에 띄운다. win.center는 다른 모니터에 띄울 때가 있다.
  const mouse = $.NSEvent.mouseLocation;
  const screens = $.NSScreen.screens;
  let screen = $.NSScreen.mainScreen;
  for (let i = 0; i < screens.count; i++) {
    const f = screens.objectAtIndex(i).frame;
    if (mouse.x >= f.origin.x && mouse.x < f.origin.x + f.size.width && mouse.y >= f.origin.y && mouse.y < f.origin.y + f.size.height) {
      screen = screens.objectAtIndex(i);
      break;
    }
  }
  const area = screen.visibleFrame;
  const size = win.frame.size;
  win.setFrameOrigin($.NSMakePoint(area.origin.x + (area.size.width - size.width) / 2, area.origin.y + (area.size.height - size.height) / 2));
  // 지금 보고 있는 Space로 옮기고, 전체 화면 앱 위에도 뜨게 한다.
  win.collectionBehavior = 2 | 256; // moveToActiveSpace | fullScreenAuxiliary
  win.makeKeyAndOrderFront(null);
  app.activateIgnoringOtherApps(true);
  if (!win.isVisible) throw new Error('Partition settings window is not visible.');
  const identity = {
    name: ObjC.unwrap($.NSRunningApplication.currentApplication.localizedName),
    bundleId: ObjC.unwrap($.NSBundle.mainBundle.bundleIdentifier),
    icon: hasPartitionIcon,
  };
  $.NSFileHandle.fileHandleWithStandardError.writeData($('PARTITION_WINDOW_READY ' + JSON.stringify(identity) + '\n').dataUsingEncoding($.NSUTF8StringEncoding));
  // 컴파일된 앱(stay-open 애플릿)은 run이 끝난 뒤 자기 이벤트 루프에서 창을 그린다.
  // 여기서 app.run으로 붙잡고 있으면 창이 만들어지기만 하고 화면에 나오지 않는다.
  if (!applet) app.run;
}
