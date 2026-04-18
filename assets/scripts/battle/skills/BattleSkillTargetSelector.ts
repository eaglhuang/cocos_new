import { Faction } from '../../core/config/Constants';
import { TroopUnit } from '../../core/models/TroopUnit';
import { BattleSkillTargetMode, type BattleSkillRequest } from '../../shared/SkillRuntimeContract';
import type { BattleSkillExecutionContext } from './BattleSkillResolver';
import type { BattleSkillProfile } from './BattleSkillProfiles';

export interface BattleSkillCellRef {
  lane: number;
  depth: number;
}

export class BattleSkillTargetSelector {
  public selectTargets(
    request: BattleSkillRequest,
    profile: BattleSkillProfile,
    context: BattleSkillExecutionContext,
  ): TroopUnit[] {
    const casterFaction = this.resolveCasterFaction(request);

    switch (profile.targetMode) {
      case BattleSkillTargetMode.Self:
        return this.selectSelfTargets(request, casterFaction, context);
      case BattleSkillTargetMode.AllySingle:
        return this.selectAllySingleTarget(request, casterFaction, context);
      case BattleSkillTargetMode.AllyAll:
        return context.getFactionUnits(casterFaction);
      case BattleSkillTargetMode.EnemyAll:
        return context.getOpposingUnits(casterFaction);
      case BattleSkillTargetMode.EnemySingle:
        return this.selectEnemySingleTarget(request, casterFaction, context);
      case BattleSkillTargetMode.Line:
        return this.selectAutoLineTargets(request, casterFaction, profile, context);
      case BattleSkillTargetMode.Fan:
        return this.selectAutoFanTargets(request, casterFaction, profile, context);
      case BattleSkillTargetMode.Tile:
        return this.selectTileTargets(request, casterFaction, context);
      case BattleSkillTargetMode.Area:
        return this.selectAreaTargets(request, casterFaction, profile, context);
      case BattleSkillTargetMode.AdjacentTiles:
        return this.selectAdjacentTileTargets(request, casterFaction, profile, context);
      default:
        return [];
    }
  }

  public selectPreviewCells(
    request: BattleSkillRequest,
    profile: BattleSkillProfile,
    context: BattleSkillExecutionContext,
  ): BattleSkillCellRef[] {
    const casterFaction = this.resolveCasterFaction(request);

    if ([
      BattleSkillTargetMode.Self,
      BattleSkillTargetMode.AllySingle,
      BattleSkillTargetMode.AllyAll,
      BattleSkillTargetMode.EnemyAll,
      BattleSkillTargetMode.EnemySingle,
      BattleSkillTargetMode.Line,
      BattleSkillTargetMode.Fan,
    ].includes(profile.targetMode)) {
      if ([BattleSkillTargetMode.Self, BattleSkillTargetMode.AllySingle, BattleSkillTargetMode.AllyAll].includes(profile.targetMode)) {
        return context.getFactionUnits(casterFaction).map((unit) => ({ lane: unit.lane, depth: unit.depth }));
      }
      return context.getOpposingUnits(casterFaction).map((unit) => ({ lane: unit.lane, depth: unit.depth }));
    }

    return context.getBoardCells();
  }

  private selectSelfTargets(
    request: BattleSkillRequest,
    casterFaction: Faction,
    context: BattleSkillExecutionContext,
  ): TroopUnit[] {
    if (request.targetUnitUid) {
      const explicitUnit = context.getUnit(request.targetUnitUid);
      if (explicitUnit && explicitUnit.faction === casterFaction && !explicitUnit.isDead()) {
        return [explicitUnit];
      }
    }

    const allies = context.getFactionUnits(casterFaction);
    return allies.length ? [allies[0]] : [];
  }

  private selectAllySingleTarget(
    request: BattleSkillRequest,
    casterFaction: Faction,
    context: BattleSkillExecutionContext,
  ): TroopUnit[] {
    if (request.targetUnitUid) {
      const explicitUnit = context.getUnit(request.targetUnitUid);
      if (explicitUnit && explicitUnit.faction === casterFaction && !explicitUnit.isDead()) {
        return [explicitUnit];
      }
    }

    const allies = [...context.getFactionUnits(casterFaction)].sort((left, right) => {
      if (left.depth !== right.depth) {
        return casterFaction === Faction.Player
          ? right.depth - left.depth
          : left.depth - right.depth;
      }
      if (left.lane !== right.lane) {
        return left.lane - right.lane;
      }
      return left.id.localeCompare(right.id);
    });

    return allies.length ? [allies[0]] : [];
  }

  private resolveAnchorTarget(
    request: BattleSkillRequest,
    casterFaction: Faction,
    context: BattleSkillExecutionContext,
  ): TroopUnit | null {
    if (request.targetUnitUid) {
      const explicitTarget = context.getUnit(request.targetUnitUid);
      if (explicitTarget && explicitTarget.faction !== casterFaction && !explicitTarget.isDead()) {
        return explicitTarget;
      }
    }

    const enemies = context.getOpposingUnits(casterFaction);
    if (!enemies.length) {
      return null;
    }

    const ordered = [...enemies].sort((left, right) => {
      if (casterFaction === Faction.Player) {
        if (left.depth !== right.depth) {
          return left.depth - right.depth;
        }
      } else if (left.depth !== right.depth) {
        return right.depth - left.depth;
      }

      if (left.lane !== right.lane) {
        return left.lane - right.lane;
      }

      return left.id.localeCompare(right.id);
    });
    return ordered[0] ?? null;
  }

  private selectEnemySingleTarget(
    request: BattleSkillRequest,
    casterFaction: Faction,
    context: BattleSkillExecutionContext,
  ): TroopUnit[] {
    const anchor = this.resolveAnchorTarget(request, casterFaction, context);
    return anchor ? [anchor] : [];
  }

  private selectAutoLineTargets(
    request: BattleSkillRequest,
    casterFaction: Faction,
    profile: BattleSkillProfile,
    context: BattleSkillExecutionContext,
  ): TroopUnit[] {
    const explicitAnchor = this.resolveExplicitTarget(request, casterFaction, context);
    if (explicitAnchor) {
      return this.selectLineTargets(explicitAnchor, casterFaction, profile, context);
    }

    return this.selectBestAnchoredTargets(
      context.getOpposingUnits(casterFaction),
      (anchor) => this.selectLineTargets(anchor, casterFaction, profile, context),
      casterFaction,
    );
  }

  private selectAutoFanTargets(
    request: BattleSkillRequest,
    casterFaction: Faction,
    profile: BattleSkillProfile,
    context: BattleSkillExecutionContext,
  ): TroopUnit[] {
    const explicitAnchor = this.resolveExplicitTarget(request, casterFaction, context);
    if (explicitAnchor) {
      return this.selectFanTargets(explicitAnchor, casterFaction, profile, context);
    }

    return this.selectBestAnchoredTargets(
      context.getOpposingUnits(casterFaction),
      (anchor) => this.selectFanTargets(anchor, casterFaction, profile, context),
      casterFaction,
    );
  }

  private selectLineTargets(
    anchor: TroopUnit,
    casterFaction: Faction,
    profile: BattleSkillProfile,
    context: BattleSkillExecutionContext,
  ): TroopUnit[] {
    const targets = context
      .getOpposingUnits(casterFaction)
      .filter((unit) => unit.lane === anchor.lane)
      .filter((unit) => casterFaction === Faction.Player
        ? unit.depth >= anchor.depth
        : unit.depth <= anchor.depth)
      .sort((left, right) => casterFaction === Faction.Player
        ? left.depth - right.depth
        : right.depth - left.depth);

    return targets.slice(0, profile.lineLength ?? profile.maxTargets ?? targets.length);
  }

  private selectFanTargets(
    anchor: TroopUnit,
    casterFaction: Faction,
    profile: BattleSkillProfile,
    context: BattleSkillExecutionContext,
  ): TroopUnit[] {
    const fanDepth = profile.fanDepth ?? 2;
    const fanHalfWidth = profile.fanHalfWidth ?? 1;

    const targets = context
      .getOpposingUnits(casterFaction)
      .filter((unit) => {
        const depthDelta = casterFaction === Faction.Player
          ? unit.depth - anchor.depth
          : anchor.depth - unit.depth;
        if (depthDelta < 0 || depthDelta >= fanDepth) {
          return false;
        }

        const laneDelta = Math.abs(unit.lane - anchor.lane);
        const allowedWidth = depthDelta === 0 ? 0 : Math.min(fanHalfWidth, depthDelta);
        return laneDelta <= allowedWidth;
      })
      .sort((left, right) => {
        const leftDepthDelta = casterFaction === Faction.Player
          ? left.depth - anchor.depth
          : anchor.depth - left.depth;
        const rightDepthDelta = casterFaction === Faction.Player
          ? right.depth - anchor.depth
          : anchor.depth - right.depth;
        if (leftDepthDelta !== rightDepthDelta) {
          return leftDepthDelta - rightDepthDelta;
        }

        const leftLaneDelta = Math.abs(left.lane - anchor.lane);
        const rightLaneDelta = Math.abs(right.lane - anchor.lane);
        if (leftLaneDelta !== rightLaneDelta) {
          return leftLaneDelta - rightLaneDelta;
        }

        if (left.lane !== right.lane) {
          return left.lane - right.lane;
        }

        return left.id.localeCompare(right.id);
      });

    return targets.slice(0, profile.maxTargets ?? targets.length);
  }

  private selectTileTargets(
    request: BattleSkillRequest,
    casterFaction: Faction,
    context: BattleSkillExecutionContext,
  ): TroopUnit[] {
    const tile = this.resolveTileTarget(request, casterFaction, context);
    if (!tile) {
      return [];
    }

    return context
      .getOpposingUnits(casterFaction)
      .filter((unit) => unit.lane === tile.lane && unit.depth === tile.depth)
      .slice(0, 1);
  }

  private selectAreaTargets(
    request: BattleSkillRequest,
    casterFaction: Faction,
    profile: BattleSkillProfile,
    context: BattleSkillExecutionContext,
  ): TroopUnit[] {
    const tile = this.resolveTileAnchor(
      request,
      casterFaction,
      context,
      (candidate) => this.getUnitsInTileRadius(candidate, casterFaction, profile.areaRadius ?? 1, false, context),
    );
    if (!tile) {
      return [];
    }

    return this.getUnitsInTileRadius(tile, casterFaction, profile.areaRadius ?? 1, false, context)
      .slice(0, profile.maxTargets ?? Number.MAX_SAFE_INTEGER);
  }

  private selectAdjacentTileTargets(
    request: BattleSkillRequest,
    casterFaction: Faction,
    profile: BattleSkillProfile,
    context: BattleSkillExecutionContext,
  ): TroopUnit[] {
    const tile = this.resolveTileAnchor(
      request,
      casterFaction,
      context,
      (candidate) => this.getUnitsInTileRadius(
        candidate,
        casterFaction,
        profile.areaRadius ?? 1,
        profile.excludeCenter ?? true,
        context,
      ),
    );
    if (!tile) {
      return [];
    }

    return this.getUnitsInTileRadius(
      tile,
      casterFaction,
      profile.areaRadius ?? 1,
      profile.excludeCenter ?? true,
      context,
    ).slice(0, profile.maxTargets ?? Number.MAX_SAFE_INTEGER);
  }

  private getUnitsInTileRadius(
    tile: BattleSkillCellRef,
    casterFaction: Faction,
    radius: number,
    excludeCenter: boolean,
    context: BattleSkillExecutionContext,
  ): TroopUnit[] {
    return context
      .getOpposingUnits(casterFaction)
      .filter((unit) => {
        const laneDelta = Math.abs(unit.lane - tile.lane);
        const depthDelta = Math.abs(unit.depth - tile.depth);
        const inRadius = Math.max(laneDelta, depthDelta) <= radius;
        if (!inRadius) {
          return false;
        }
        if (excludeCenter && laneDelta === 0 && depthDelta === 0) {
          return false;
        }
        return true;
      })
      .sort((left, right) => {
        const leftDistance = this.getChebyshevDistance(tile, left.lane, left.depth);
        const rightDistance = this.getChebyshevDistance(tile, right.lane, right.depth);
        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance;
        }
        if (left.lane !== right.lane) {
          return left.lane - right.lane;
        }
        if (left.depth !== right.depth) {
          return left.depth - right.depth;
        }
        return left.id.localeCompare(right.id);
      });
  }

  private resolveExplicitTarget(
    request: BattleSkillRequest,
    casterFaction: Faction,
    context: BattleSkillExecutionContext,
  ): TroopUnit | null {
    if (!request.targetUnitUid) {
      return null;
    }

    const explicitTarget = context.getUnit(request.targetUnitUid);
    if (explicitTarget && explicitTarget.faction !== casterFaction && !explicitTarget.isDead()) {
      return explicitTarget;
    }

    return null;
  }

  private selectBestAnchoredTargets(
    candidates: TroopUnit[],
    resolver: (anchor: TroopUnit) => TroopUnit[],
    casterFaction: Faction,
  ): TroopUnit[] {
    let bestAnchor: TroopUnit | null = null;
    let bestTargets: TroopUnit[] = [];

    for (const candidate of candidates) {
      const targets = resolver(candidate);
      if (!targets.length) {
        continue;
      }

      if (!bestAnchor || this.isBetterTargetSet(targets, candidate, bestTargets, bestAnchor, casterFaction)) {
        bestAnchor = candidate;
        bestTargets = targets;
      }
    }

    return bestTargets;
  }

  private isBetterTargetSet(
    nextTargets: TroopUnit[],
    nextAnchor: TroopUnit,
    bestTargets: TroopUnit[],
    bestAnchor: TroopUnit,
    casterFaction: Faction,
  ): boolean {
    if (nextTargets.length !== bestTargets.length) {
      return nextTargets.length > bestTargets.length;
    }

    return this.compareTargetPriority(nextAnchor, bestAnchor, casterFaction) < 0;
  }

  private resolveTileTarget(
    request: BattleSkillRequest,
    casterFaction: Faction,
    context: BattleSkillExecutionContext,
  ): BattleSkillCellRef | null {
    const explicitTile = this.parseTileId(request.targetTileId);
    if (explicitTile) {
      return explicitTile;
    }

    const anchor = this.resolveAnchorTarget(request, casterFaction, context);
    return anchor ? { lane: anchor.lane, depth: anchor.depth } : null;
  }

  private resolveTileAnchor(
    request: BattleSkillRequest,
    casterFaction: Faction,
    context: BattleSkillExecutionContext,
    resolver: (candidate: BattleSkillCellRef) => TroopUnit[],
  ): BattleSkillCellRef | null {
    const explicitTile = this.parseTileId(request.targetTileId);
    if (explicitTile) {
      return explicitTile;
    }

    let bestTile: BattleSkillCellRef | null = null;
    let bestTargets: TroopUnit[] = [];
    for (const candidate of context.getBoardCells()) {
      const targets = resolver(candidate);
      if (!targets.length) {
        continue;
      }

      if (!bestTile || this.isBetterTileTargetSet(targets, candidate, bestTargets, bestTile, casterFaction)) {
        bestTile = candidate;
        bestTargets = targets;
      }
    }

    return bestTile;
  }

  private isBetterTileTargetSet(
    nextTargets: TroopUnit[],
    nextTile: BattleSkillCellRef,
    bestTargets: TroopUnit[],
    bestTile: BattleSkillCellRef,
    casterFaction: Faction,
  ): boolean {
    if (nextTargets.length !== bestTargets.length) {
      return nextTargets.length > bestTargets.length;
    }

    return this.compareTilePriority(nextTile, bestTile, casterFaction) < 0;
  }

  private compareTargetPriority(left: TroopUnit, right: TroopUnit, casterFaction: Faction): number {
    const frontDiff = this.getFrontPriority(casterFaction, left.depth) - this.getFrontPriority(casterFaction, right.depth);
    if (frontDiff !== 0) {
      return frontDiff;
    }

    if (left.currentHp !== right.currentHp) {
      return left.currentHp - right.currentHp;
    }

    if (left.lane !== right.lane) {
      return left.lane - right.lane;
    }

    return left.id.localeCompare(right.id);
  }

  private compareTilePriority(left: BattleSkillCellRef, right: BattleSkillCellRef, casterFaction: Faction): number {
    const frontDiff = this.getFrontPriority(casterFaction, left.depth) - this.getFrontPriority(casterFaction, right.depth);
    if (frontDiff !== 0) {
      return frontDiff;
    }

    if (left.lane !== right.lane) {
      return left.lane - right.lane;
    }

    return left.depth - right.depth;
  }

  private getFrontPriority(casterFaction: Faction, depth: number): number {
    return casterFaction === Faction.Player ? depth : -depth;
  }

  private getChebyshevDistance(tile: BattleSkillCellRef, lane: number, depth: number): number {
    return Math.max(Math.abs(lane - tile.lane), Math.abs(depth - tile.depth));
  }

  private parseTileId(tileId?: string | null): BattleSkillCellRef | null {
    if (!tileId) {
      return null;
    }

    const [laneRaw, depthRaw] = tileId.split(',');
    const lane = Number(laneRaw);
    const depth = Number(depthRaw);
    if (!Number.isInteger(lane) || !Number.isInteger(depth)) {
      return null;
    }

    return { lane, depth };
  }

  private resolveCasterFaction(request: BattleSkillRequest): Faction {
    return request.ownerUid === Faction.Enemy ? Faction.Enemy : Faction.Player;
  }
}
