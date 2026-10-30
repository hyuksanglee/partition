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
  if (!Array.isArray(argv)) argv = ObjC.deepUnwrap($.NSProcessInfo.processInfo.arguments).slice(1);
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
  win.delegate = $.PartitionWindowDelegate.alloc.init;

  win.center;
  win.makeKeyAndOrderFront(null);
  app.activateIgnoringOtherApps(true);
  if (!win.isVisible) throw new Error('Partition settings window is not visible.');
  const identity = {
    name: ObjC.unwrap($.NSRunningApplication.currentApplication.localizedName),
    bundleId: ObjC.unwrap($.NSBundle.mainBundle.bundleIdentifier),
    icon: hasPartitionIcon,
  };
  $.NSFileHandle.fileHandleWithStandardError.writeData($('PARTITION_WINDOW_READY ' + JSON.stringify(identity) + '\n').dataUsingEncoding($.NSUTF8StringEncoding));
  app.run;
}
