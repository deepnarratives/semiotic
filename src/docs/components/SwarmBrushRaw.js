import * as React from "react"
import { OrdinalFrame } from "../../components"
import ProcessViz from "./ProcessViz"

const data = Array.from(Array(200), () => ({
  value: parseInt(Math.random() * 100, 10)
}))

const orFrameSettings = {
  size: [700, 200],
  rAccessor: "value",
  oAccessor: () => "singleColumn",
  style: { fill: "steelblue", stroke: "white", strokeWidth: 1 },
  type: "swarm",
  summaryType: "violin",
  summaryStyle: {
    fill: "steelblue",
    fillOpacity: 0.3,
    stroke: "white",
    strokeWidth: 1
  },
  projection: "horizontal",
  axes: [{ orient: "bottom" }],
  rExtent: [0, 100],
  margin: { left: 20, top: 0, bottom: 50, right: 20 },
  data
}

export default (data, event, resetExtent) => {
  const swarmBrushChart = {
    ...orFrameSettings,
    interaction: {
      columnsBrush: true,
      extent: { singleColumn: resetExtent },
      end: event
    }
  }

  return (
    <div>
      <ProcessViz frameSettings={swarmBrushChart} frameType="OrdinalFrame" />
      <OrdinalFrame {...swarmBrushChart} projection="vertical" size={[200, 500]} axes={[{ orient: "right" }]} margin={{ right: 50, top: 10, botom: 30 }} />
      <OrdinalFrame {...swarmBrushChart} />
    </div>
  )
}
