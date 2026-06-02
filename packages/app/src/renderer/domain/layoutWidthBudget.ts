export const SIDEBAR_SOFT_MIN_WIDTH_PX = 260;
export const SIDEBAR_HARD_MIN_WIDTH_PX = 240;
export const SIDEBAR_COLLAPSED_MIN_WIDTH_PX = 160;
export const CENTER_BASE_MIN_WIDTH_PX = 520;
export const CENTER_TIMELINE_SOFT_MIN_WIDTH_PX = 380;
export const CENTER_TIMELINE_HARD_MIN_WIDTH_PX = 330;
export const CENTER_EDITOR_SOFT_MIN_WIDTH_PX = 360;
export const CENTER_EDITOR_HARD_MIN_WIDTH_PX = 320;
export const CENTER_EDITOR_SASH_WIDTH_PX = 10;
export const CENTER_WITH_EDITOR_HARD_MIN_WIDTH_PX =
  CENTER_TIMELINE_HARD_MIN_WIDTH_PX + CENTER_EDITOR_SASH_WIDTH_PX + CENTER_EDITOR_HARD_MIN_WIDTH_PX;
const SHELL_SIDES = ["left", "files", "right"] as const;
type ShellSide = (typeof SHELL_SIDES)[number];

export type ShellWidthBudget = {
  containerWidth: number;
  leftVisible: boolean;
  filesVisible: boolean;
  rightVisible: boolean;
  leftPreferredWidth: number;
  filesPreferredWidth: number;
  rightPreferredWidth: number;
  centerHardMinWidth: number;
  prioritySide?: ShellSide | null;
};

export type ResolvedShellWidths = {
  leftWidth: number;
  centerWidth: number;
  filesWidth: number;
  rightWidth: number;
};

export type CenterWidthBudget = {
  containerWidth: number;
  editorVisible: boolean;
  editorPreferredWidth: number;
};

export type ResolvedCenterWidths = {
  timelineWidth: number;
  editorWidth: number;
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function toRoundedWidth(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function toShellSideOrder(widths: Record<ShellSide, number>, prioritySide?: ShellSide | null): ShellSide[] {
  const visibleSides = SHELL_SIDES.filter((side) => widths[side] > 0);
  if (visibleSides.length <= 1) return [...visibleSides];

  const sorted = [...visibleSides].sort((a, b) => widths[b] - widths[a]);
  if (!prioritySide || !sorted.includes(prioritySide)) return sorted;

  return [...sorted.filter((side) => side !== prioritySide), prioritySide];
}

function shrinkSidebarsToStage(
  widths: Record<ShellSide, number>,
  targets: Record<ShellSide, number>,
  overflow: number,
  prioritySide?: ShellSide | null
): number {
  if (overflow <= 0) return 0;
  const order = toShellSideOrder(widths, prioritySide);

  let remaining = overflow;
  for (const side of order) {
    const current = widths[side];
    const target = targets[side];
    const slack = Math.max(0, current - target);
    if (slack <= 0) continue;
    const delta = Math.min(slack, remaining);
    widths[side] = current - delta;
    remaining -= delta;
    if (remaining <= 0) return 0;
  }
  return remaining;
}

export function resolveShellWidths(budget: ShellWidthBudget): ResolvedShellWidths {
  const containerWidth = toRoundedWidth(budget.containerWidth);
  const centerHardMinWidth = toRoundedWidth(budget.centerHardMinWidth);
  const widths: Record<ShellSide, number> = {
    left: budget.leftVisible ? Math.max(SIDEBAR_HARD_MIN_WIDTH_PX, toRoundedWidth(budget.leftPreferredWidth)) : 0,
    files: budget.filesVisible ? Math.max(SIDEBAR_HARD_MIN_WIDTH_PX, toRoundedWidth(budget.filesPreferredWidth)) : 0,
    right: budget.rightVisible ? Math.max(SIDEBAR_HARD_MIN_WIDTH_PX, toRoundedWidth(budget.rightPreferredWidth)) : 0,
  };

  const overflowInitial = Math.max(0, widths.left + widths.files + widths.right + centerHardMinWidth - containerWidth);
  if (overflowInitial > 0) {
    let overflow = overflowInitial;
    overflow = shrinkSidebarsToStage(
      widths,
      {
        left: budget.leftVisible ? SIDEBAR_SOFT_MIN_WIDTH_PX : 0,
        files: budget.filesVisible ? SIDEBAR_SOFT_MIN_WIDTH_PX : 0,
        right: budget.rightVisible ? SIDEBAR_SOFT_MIN_WIDTH_PX : 0,
      },
      overflow,
      budget.prioritySide
    );
    if (overflow > 0) {
      overflow = shrinkSidebarsToStage(
        widths,
        {
          left: budget.leftVisible ? SIDEBAR_HARD_MIN_WIDTH_PX : 0,
          files: budget.filesVisible ? SIDEBAR_HARD_MIN_WIDTH_PX : 0,
          right: budget.rightVisible ? SIDEBAR_HARD_MIN_WIDTH_PX : 0,
        },
        overflow,
        budget.prioritySide
      );
    }
    if (overflow > 0) {
      overflow = shrinkSidebarsToStage(
        widths,
        {
          left: budget.leftVisible ? SIDEBAR_COLLAPSED_MIN_WIDTH_PX : 0,
          files: budget.filesVisible ? SIDEBAR_COLLAPSED_MIN_WIDTH_PX : 0,
          right: budget.rightVisible ? SIDEBAR_COLLAPSED_MIN_WIDTH_PX : 0,
        },
        overflow,
        budget.prioritySide
      );
    }
    if (overflow > 0) {
      shrinkSidebarsToStage(
        widths,
        {
          left: 0,
          files: 0,
          right: 0,
        },
        overflow,
        budget.prioritySide
      );
    }
  }

  return {
    leftWidth: widths.left,
    centerWidth: Math.max(0, containerWidth - widths.left - widths.files - widths.right),
    filesWidth: widths.files,
    rightWidth: widths.right,
  };
}

export function resolveCenterWidths(budget: CenterWidthBudget): ResolvedCenterWidths {
  const containerWidth = toRoundedWidth(budget.containerWidth);
  if (!budget.editorVisible) {
    return {
      timelineWidth: containerWidth,
      editorWidth: 0,
    };
  }

  const contentWidth = Math.max(0, containerWidth - CENTER_EDITOR_SASH_WIDTH_PX);
  const maxEditorWidth = Math.max(CENTER_EDITOR_HARD_MIN_WIDTH_PX, contentWidth - CENTER_TIMELINE_HARD_MIN_WIDTH_PX);
  let editorWidth = clamp(toRoundedWidth(budget.editorPreferredWidth), CENTER_EDITOR_HARD_MIN_WIDTH_PX, maxEditorWidth);
  let timelineWidth = Math.max(0, containerWidth - CENTER_EDITOR_SASH_WIDTH_PX - editorWidth);

  if (timelineWidth < CENTER_TIMELINE_SOFT_MIN_WIDTH_PX) {
    const softEditorCap = Math.max(CENTER_EDITOR_SOFT_MIN_WIDTH_PX, contentWidth - CENTER_TIMELINE_SOFT_MIN_WIDTH_PX);
    editorWidth = Math.min(editorWidth, softEditorCap);
    timelineWidth = Math.max(0, containerWidth - CENTER_EDITOR_SASH_WIDTH_PX - editorWidth);
  }

  if (timelineWidth < CENTER_TIMELINE_HARD_MIN_WIDTH_PX) {
    const hardEditorCap = Math.max(CENTER_EDITOR_HARD_MIN_WIDTH_PX, contentWidth - CENTER_TIMELINE_HARD_MIN_WIDTH_PX);
    editorWidth = Math.min(editorWidth, hardEditorCap);
    timelineWidth = Math.max(0, containerWidth - CENTER_EDITOR_SASH_WIDTH_PX - editorWidth);
  }

  return {
    timelineWidth,
    editorWidth,
  };
}
