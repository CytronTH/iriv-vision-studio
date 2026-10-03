import re

with open('src/components/LiveDashboard.jsx', 'r') as f:
    content = f.read()

# Add imports for new widgets
imports = """
import GaugeWidget from './DashboardWidgets/GaugeWidget';
import TrafficLightWidget from './DashboardWidgets/TrafficLightWidget';
import RadialDonutWidget from './DashboardWidgets/RadialDonutWidget';
import CapacityBarWidget from './DashboardWidgets/CapacityBarWidget';
import TargetTrackerWidget from './DashboardWidgets/TargetTrackerWidget';
"""
content = content.replace("import MetricWidget from './DashboardWidgets/MetricWidget';", imports.strip() + "\nimport MetricWidget from './DashboardWidgets/MetricWidget';")

# Add to WIDGET_TYPES
new_widgets = """
  { type: 'gauge', label: '⏱️ Gauge', minW: 2, minH: 2 },
  { type: 'trafficLight', label: '🚦 Traffic Light', minW: 2, minH: 3 },
  { type: 'radialDonut', label: '🍩 Radial Donut', minW: 2, minH: 2 },
  { type: 'capacityBar', label: '🔋 Capacity Bar', minW: 2, minH: 2 },
  { type: 'targetTracker', label: '🎯 Target Tracker', minW: 3, minH: 3 },
"""
content = content.replace("{ type: 'video', label: '📺 Video Stream', minW: 2, minH: 2 },", "{ type: 'video', label: '�� Video Stream', minW: 2, minH: 2 },\n" + new_widgets.strip())

# Add rendering logic
render_logic = """
                {type === 'gauge' && <GaugeWidget title={config.title} config={config} metadata={metadata} />}
                {type === 'trafficLight' && <TrafficLightWidget title={config.title} config={config} metadata={metadata} />}
                {type === 'radialDonut' && <RadialDonutWidget title={config.title} config={config} metadata={metadata} />}
                {type === 'capacityBar' && <CapacityBarWidget title={config.title} config={config} metadata={metadata} />}
                {type === 'targetTracker' && <TargetTrackerWidget title={config.title} config={config} metadata={metadata} />}
"""
content = content.replace("{type === 'textFeed' && (", render_logic.strip() + "\n                {type === 'textFeed' && (")

with open('src/components/LiveDashboard.jsx', 'w') as f:
    f.write(content)
