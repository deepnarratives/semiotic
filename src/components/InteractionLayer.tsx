import * as React from "react"
import { brushX, brushY, brush } from "d3-brush"
import { select, event } from "d3-selection"

// components
import Brush from "./Brush"
import { Brush as VXBrush } from "@vx/brush"

import { HOCSpanOrDiv } from "./SpanOrDiv"

import { Interactivity, InteractionLayerProps, BaseColumnType, InteractionLayerState } from "./types/interactionTypes"

import { brushing, brushEnd, brushStart, calculateOverlay } from "./processing/InteractionItems"
import InteractionCanvas from "./interactionLayerBehavior/InteractionCanvas";

import { scaleLinear } from "d3-scale"

const generateOMappingFn = projectedColumns => (d): null | any => {
  if (d) {
    const columnValues = Object.values(projectedColumns)

    const foundColumns = columnValues.filter(
      (c: { x: number; width: number }) => {
        return d[1] >= c.x && d[0] <= c.x + c.width
      }
    )
    return foundColumns
  }
  return null
}

const generateOEndMappingFn = projectedColumns => (d): null | Array<any> => {
  if (
    d &&
    event.sourceEvent &&
    event.sourceEvent.path &&
    event.sourceEvent.path[1] &&
    event.sourceEvent.path[1].classList.contains("xybrush") &&
    event.target.move
  ) {
    const columnValues: BaseColumnType[] = Object.values(projectedColumns)
    const foundColumns: BaseColumnType[] = columnValues.filter(
      (c: BaseColumnType) => d[1] >= c.x && d[0] <= c.x + c.width
    )

    const firstColumn: { x: number; width: number } = foundColumns[0] || {
      x: 0,
      width: 0
    }

    const lastColumn: { x: number; width: number } = foundColumns[
      foundColumns.length - 1
    ] || {
        x: 0,
        width: 0
      }

    const columnPosition = [
      firstColumn.x + Math.min(5, firstColumn.width / 10),
      lastColumn.x + lastColumn.width - Math.min(5, lastColumn.width / 10)
    ]

    select(event.sourceEvent.path[1])
      .transition(750)
      .call(event.target.move, columnPosition)

    return foundColumns
  }
  return null
}

class InteractionLayer extends React.PureComponent<InteractionLayerProps, InteractionLayerState> {
  constructor(props: InteractionLayerProps) {
    super(props)

    const canvasMap: Map<string, number> = new Map()

    const { canvasRendering, useSpans, svgSize, margin, voronoiHover } = props

    const initialOverlayRegions = calculateOverlay(props)

    this.state = {
      overlayRegions: initialOverlayRegions,
      canvasMap,
      interactionCanvas: canvasRendering && <InteractionCanvas
        height={svgSize[1]}
        width={svgSize[0]}
        overlayRegions={initialOverlayRegions}
        margin={margin}
        voronoiHover={voronoiHover}
      />,
      props,
      SpanOrDiv: HOCSpanOrDiv(useSpans)
    }
  }

  static defaultProps = {
    svgSize: [500, 500]
  }

  createBrush = (interaction: Interactivity) => {
    let semioticBrush, mappingFn, selectedExtent, endMappingFn

    const { xScale, yScale, size, renderPipeline } = this.props

    const brushData = {}

    Object.entries(renderPipeline).forEach(([key, value]) => {
      if (value.data && value.data.length > 0) {
        brushData[key] = value.data
      }
    })

    const { projection, projectedColumns } = interaction

    const actualBrush =
      interaction.brush === "oBrush"
        ? projection === "horizontal"
          ? "yBrush"
          : "xBrush"
        : interaction.brush

    const {
      extent = actualBrush === "xyBrush"
        ? [
          [xScale.invert(0), yScale.invert(0)],
          [xScale.invert(size[0]), yScale.invert(size[1])]
        ]
        : actualBrush === "xBrush"
          ? [xScale.invert(0), xScale.invert(size[0])]
          : [yScale.invert(0), yScale.invert(size[1])]
    } = interaction

    if (extent.indexOf && extent.indexOf(undefined) !== -1) {
      return <g />
    }

    if (actualBrush === "xBrush") {
      const castExtent = extent as number[]
      mappingFn = (d): null | object =>
        !d ? null : [d.x0, d.x1]
      semioticBrush = brushX()
      selectedExtent = castExtent.map(d => xScale(d)) as number[]
      endMappingFn = mappingFn
    } else if (actualBrush === "yBrush") {
      const castExtent = extent as number[]

      mappingFn = (d): null | object =>
        !d
          ? null
          : [d.y0, d.y1].sort((a, b) => a - b)
      semioticBrush = brushY()
      selectedExtent = castExtent.map(d => yScale(d)).sort((a, b) => a - b)
      endMappingFn = mappingFn
    } else {
      const castExtent = extent as number[][]
      if (
        castExtent.indexOf(undefined) !== -1 ||
        castExtent[0].indexOf(undefined) !== -1 ||
        castExtent[1].indexOf(undefined) !== -1
      ) {
        return <g />
      }

      semioticBrush = brush()
      mappingFn = (d): null | object => {
        if (!d) return null
        const yValues = [d.y0, d.y1].sort(
          (a, b) => a - b
        )

        return [
          [d.x0, yValues[0]],
          [d.x1, yValues[1]]
        ]
      }

      const yValues = [yScale(extent[0][1]), yScale(extent[1][1])].sort(
        (a, b) => a - b
      )

      selectedExtent = castExtent.map((d, i) => [xScale(d[0]), yValues[i]])

      endMappingFn = mappingFn
    }

    if (interaction.brush === "oBrush") {
      selectedExtent = null
      if (interaction.extent) {
        const [leftExtent, rightExtent] = interaction.extent
        if (
          (typeof leftExtent === "string" || typeof leftExtent === "number") &&
          (typeof rightExtent === "string" || typeof rightExtent === "number")
        ) {
          selectedExtent = [
            projectedColumns[leftExtent].x,
            projectedColumns[rightExtent].x +
            projectedColumns[rightExtent].width
          ]
        }
      }

      mappingFn = generateOMappingFn(projectedColumns)
      endMappingFn = generateOEndMappingFn(projectedColumns)
    }

    semioticBrush
      .extent([[0, 0], [size[0], size[1]]])
      .on("start", () => {
        brushStart(mappingFn(event.selection), undefined, brushData, undefined, interaction)
      })
      .on("brush", () => {
        brushing(mappingFn(event.selection), undefined, brushData, undefined, interaction)
      })
      .on("end", () => {
        brushEnd(endMappingFn(event.selection), undefined, brushData, undefined, interaction)
      })

    const resizeTriggerAreas = actualBrush === "xyBrush" ? ['left', 'right', 'top', 'bottom', 'bottomRight', 'bottomLeft', 'topRight', 'topLeft'] : actualBrush === "yBrush" ? ["top", "botom"] : ["left", "right"]
    const brushDirection = actualBrush === "xyBrush" ? "both" : actualBrush === "xBrush" ? "horizontal" : "vertical"


    return (<>
      <VXBrush
        width={xScale.range()[1]}
        height={yScale.range()[0]}
        handleSize={10}
        xScale={xScale}
        yScale={yScale}
        margin={{ top: 10, bottom: 10, left: 10, right: 10 }}
        resizeTriggerAreas={resizeTriggerAreas}
        brushDirection={brushDirection}
        onBrushStart={e => brushStart(mappingFn(e), undefined, brushData, undefined, interaction)}
        onBrushEnd={e => brushEnd(mappingFn(e), undefined, brushData, undefined, interaction)}
        onChange={e => brushing(mappingFn(e), undefined, brushData, undefined, interaction)}
        selectedBoxStyle={{
          fill: 'black',
          stroke: 'blue',
        }}
      />
      {/*<g className="brush">
        <Brush
          selectedExtent={selectedExtent}
          extent={extent}
          svgBrush={semioticBrush}
        />
      </g>*/}
    </>
    )
  }

  static getDerivedStateFromProps(nextProps: InteractionLayerProps, prevState: InteractionLayerState) {
    const { props } = prevState

    if (
      props.overlay !== nextProps.overlay ||
      nextProps.points !== props.points ||
      props.xScale !== nextProps.xScale ||
      props.yScale !== nextProps.yScale ||
      ((!props.hoverAnnotation && nextProps.hoverAnnotation) || (props.hoverAnnotation && !nextProps.hoverAnnotation))
    ) {

      const { disableCanvasInteraction, canvasRendering, svgSize, margin, voronoiHover } = nextProps
      const { overlayRegions } = prevState

      let nextOverlay, interactionCanvas

      if (disableCanvasInteraction ||
        !overlayRegions) {
        nextOverlay = null
        interactionCanvas = null
      } else {
        nextOverlay = calculateOverlay(nextProps)
        if (canvasRendering) {
          interactionCanvas = <InteractionCanvas
            height={svgSize[1]}
            width={svgSize[0]}
            overlayRegions={nextOverlay}
            margin={margin}
            voronoiHover={voronoiHover}
          />

        }
      }

      return {
        overlayRegions: nextOverlay,
        props: nextProps,
        interactionCanvas
      }
    }

    return null

  }

  createColumnsBrush = (interaction: Interactivity) => {
    const { projection, rScale, oColumns, renderPipeline } = this.props

    if (!projection || !rScale || !oColumns) return

    const brushData = {}
    Object.entries(renderPipeline).forEach(([key, value]) => {
      if (value.data && value.data.length > 0) {
        brushData[key] = value.data
      }
    })

    let semioticBrush, mappingFn

    const rScaleReverse = rScale
      .copy()
      .domain(rScale.domain())
      .range(rScale.domain().reverse())

    if (projection && projection === "horizontal") {
      mappingFn = (d): null | object => {
        return !d ? null : [d.x0, d.x1]
      }
    } else
      mappingFn = (d): null | object => {
        return !d
          ? null
          : [
            rScaleReverse(d.y1),
            rScaleReverse(d.y0)
          ]
      }

    const rRange = rScale.range()

    const columnHash = oColumns
    let brushPosition, selectedExtent
    const brushes: Array<React.ReactNode> = Object.keys(columnHash).map(c => {
      const currentColumn = columnHash[c]
      if (projection && projection === "horizontal") {
        selectedExtent = interaction.extent[c]
          ? interaction.extent[c].map(d => rScale(d))
          : interaction.startEmpty ? null : rRange

        brushPosition = [0, currentColumn.x]
        semioticBrush = brushX()
        semioticBrush
          .extent([[rRange[0], 0], [rRange[1], currentColumn.width]])
          .on("start", () => {
            brushStart(mappingFn(event.selection), c, brushData, currentColumn, interaction)
          })
          .on("brush", () => {
            brushing(mappingFn(event.selection), c, brushData, currentColumn, interaction)
          })
          .on("end", () => {
            brushEnd(mappingFn(event.selection), c, brushData, currentColumn, interaction)
          })
      } else {
        selectedExtent = interaction.extent[c]
          ? interaction.extent[c].map(d => rRange[1] - rScale(d)).reverse()
          : interaction.startEmpty ? null : rRange
        brushPosition = [currentColumn.x, 0]
        semioticBrush = brushY()
        semioticBrush
          .extent([[0, rRange[0]], [currentColumn.width, rRange[1]]])
          .on("start", () => {
            brushStart(mappingFn(event.selection), c, brushData, currentColumn, interaction)
          })
          .on("brush", () => {
            brushing(mappingFn(event.selection), c, brushData, currentColumn, interaction)
          })
          .on("end", () => {
            brushEnd(mappingFn(event.selection), c, brushData, currentColumn, interaction)
          })
      }

      const columnWidth = currentColumn.width

      const columnScale = scaleLinear().domain([0, columnWidth]).range([0, columnWidth])

      const xScaleForBrush = projection === "horizontal" ? rScale : columnScale
      const yScaleForBrush = projection === "horizontal" ? columnScale : rScale
      const brushDirection = projection === "horizontal" ? "horizontal" : "vertical"
      const resizeTriggerAreas = projection === "horizontal" ? ['left', 'right', 'bottomRight'] : ["top", "botom"]

      return (
        <VXBrush
          width={xScaleForBrush.range()[1]}
          height={yScaleForBrush.range()[1]}
          handleSize={10}
          xScale={xScaleForBrush}
          yScale={yScaleForBrush}
          margin={{ top: 10, bottom: 10, left: 10, right: 10 }}
          resizeTriggerAreas={resizeTriggerAreas}
          brushDirection={brushDirection}
          onBrushStart={e => brushStart(mappingFn(e), c, brushData, currentColumn, interaction)}
          onBrushEnd={e => brushEnd(mappingFn(e), c, brushData, currentColumn, interaction)}
          onChange={e => brushing(mappingFn(e), c, brushData, currentColumn, interaction)}
          selectedBoxStyle={{
            fill: 'black',
            stroke: 'blue',
          }}
        />
      )
    })
    return brushes
  }

  render() {

    let semioticBrush = null
    const {
      interaction,
      svgSize,
      margin,
      useSpans = false
    } = this.props

    const { overlayRegions, interactionCanvas, SpanOrDiv } = this.state
    let { enabled } = this.props

    if (interaction && interaction.brush) {
      enabled = true
      semioticBrush = this.createBrush(interaction)
    }

    if (interaction && interaction.columnsBrush) {
      enabled = true
      semioticBrush = this.createColumnsBrush(interaction)
    }

    if (!overlayRegions && !semioticBrush) {
      return null
    }

    return (
      <SpanOrDiv
        span={useSpans}
        className="interaction-layer"
        style={{
          position: "absolute",
          background: "none",
          pointerEvents: "none"
        }}
      >
        {interactionCanvas || (
          <svg
            height={svgSize[1]}
            width={svgSize[0]}
            style={{ background: "none", pointerEvents: "none" }}
          >
            <g
              className="interaction-overlay"
              transform={`translate(${margin.left},${margin.top})`}
              style={{ pointerEvents: enabled ? "all" : "none" }}
            >
              <g className="interaction-regions">{overlayRegions}</g>
              {semioticBrush}
            </g>
          </svg>
        )}
      </SpanOrDiv>
    )
  }
}

export default InteractionLayer
