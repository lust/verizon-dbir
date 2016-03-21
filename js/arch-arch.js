/* GLOBALS */
'use strict';

var width = document.documentElement.clientWidth; // width of svg image
var height = document.documentElement.clientHeight; // height of svg image
var margin = 40; // amount of margin around plot area
//var pad = margin / 2; // actual padding amount
var radius = width < 1600 ? 20 : 40; // fixed node radius
var yfixed = height / 2; // y position for all nodes
var xfixed = radius;
let linkScale;

d3.json("finaldata/2016_supergraph.json", function (error, data) {
    if (error) return console.warn(error);

    let processed = processData(data);
    arcDiagram(processed);
});

function processData(data) {
    let output = {
        nodes: [],
        edges: []
    };
    let graph = data.graphml.graph;

    let startNode, endNode;
    // Build nodes
    for (let i = 0; i < graph.node.length; i++) {
        let node = graph.node[i];

        let data = {};
        for (let j = 0; j < node.data.length; j++) {
            let datum = node.data[j];
            if (datum["@key"] == "d0")
                data.count = +datum["#text"];
            else if (datum["@key"] == "d1")
                data.type = datum["#text"];
            else if (datum["@key"] == "d2")
                data.subType = datum["#text"];
            else if (datum["@key"] == "d3")
                data.weight = +datum["#text"];
            else if (datum["@key"] == "d4")
                data.label = datum["#text"];
        }

        let nodeObj = {
            "name": node["@id"],
            "data": data
        }
        if (nodeObj.name == "start") {
            startNode = nodeObj;
            continue;
        } else if (nodeObj.name == "end") {
            endNode = nodeObj;
            continue;
        }
        //        console.log(nodeObj.name + ',' + nodeObj.data.count);
        output.nodes.push(nodeObj);
    }

    // maps actions before attributes
    let map = {
        action: 0,
        attribute: 1
    }
    output.nodes.sort(function (a, b) {
        //        console.log(a.data.type-b.data.type);
        return map[a.data.type] - map[b.data.type];
    });

    // adds start and end nodes
    output.nodes.unshift(startNode);
    output.nodes.push(endNode);

    // Build edges
    for (let i = 0; i < graph.edge.length; i++) {
        let edge = graph.edge[i];

        // Find Source
        let sourceName = edge["@source"];
        let sourceNode = output.nodes.filter(function (node) {
            return node.name == sourceName;
        })[0];

        // Find Target
        let targetName = edge["@target"];
        let targetNode = output.nodes.filter(function (node) {
            return node.name == targetName;
        })[0];

        let data = {};

        for (let j = 0; j < edge.data.length; j++) {
            let datum = edge.data[j];

            if (datum["@key"] == "d5")
                data.count = +datum["#text"];
            else if (datum["@key"] == "d6")
                data.direction = datum["#text"];
            else if (datum["@key"] == "d7")
                data.weight = +datum["#text"];
            else if (datum["@key"] == "d8")
                data.label = datum["#text"];
        }

        if (sourceNode.name == targetNode.name)
            continue;

        output.edges.push({
            source: sourceNode,
            target: targetNode,
            data: data
        });
        //                        if (data.direction == "forward") {
        //                            output.edges.push({
        //                                source: sourceNode,
        //                                target: targetNode,
        //                                data: data
        //                            });
        //                        } else {
        //                            output.edges.push({
        //                                source: targetNode,
        //                                target: sourceNode,
        //                                data: data
        //                            });
        //                        }

    }

    //    console.log(output);
    return output;
}

/* HELPER FUNCTIONS */

// Generates a tooltip for a SVG circle element based on its ID
function addTooltip(circle) {
    var x = parseFloat(circle.attr("cx")) + radius;
    var y = parseFloat(circle.attr("cy")) - radius;
    var r = 10;
    var text = circle.attr("id");

    var split = text.split('.');
    if (split.length == 1)
        text = split[0];
    else
        text = split[1];
    var tooltip = d3.select("#plot")
        .append("text")
        .text(text.toUpperCase())
        .attr("transform", "translate(" + x + "," + y + ")rotate(-45)")
        .attr("class", function () {
            if (split.length == 2) {
                return split[0] + " tooltip";
            }
            return "tooltip";
        });

    var offset = tooltip.node().getBBox().width / 2;

}

/* MAIN DRAW METHOD */

// Draws an arc diagram for the provided undirected graph
function arcDiagram(graph) {
    // create svg image
    var svg = d3.select("body")
        .append("svg")
        .attr("id", "arc")
        .attr("width", width)
        .attr("height", height);

    // draw border around svg image
    // svg.append("rect")
    //     .attr("class", "outline")
    //     .attr("width", width)
    //     .attr("height", height);

    // create plot area within svg image
    let offset = width / 2 - (margin + height - margin) / 2;
    var plot = svg.append("g")
        .attr("id", "plot")
        .attr("transform", "translate(" + offset + ", 0)");

    //    let wp = (width+margin)/2+width*.4;
    svg.append("text")
        .text("LINKS TO ACTIONS")
        .attr('class', 'label')
        .style('text-anchor', 'middle')
        .attr('transform', 'translate(' + width / 2 + ',' + margin + ')');
    //
    let wp = height - margin;
    svg.append("text")
        .text("LINKS TO ATTRIBUTES")
        .attr('class', 'label')
        .style('text-anchor', 'middle')
        .attr('transform', 'translate(' + width / 2 + ',' + wp + ')');
    
    svg.append("text")
        .text("INCIDENT COUNT")
        .attr('class', 'label')
        .style('text-anchor', 'end')
        .attr('dy', '.35em')
        .attr('transform', 'translate(' + offset + ',' + height/2 + ')');

    //    var header = svg.append("text")
    //        .attr('class','heading')
    //        .attr('transform', 'translate(100, 50)');
    //    
    //    header.append("tspan")
    //        .text("2015 DBIR");
    //    
    //    header.append("tspan")
    //        .text("ATTACK GRAPH")
    //        .attr("x", 0)
    //        .attr("y", 50);
    // must be done AFTER links are fixed
    linearLayout(graph.nodes);

    // draw links first, so nodes appear on top
    drawLinks(graph.edges);

    // draw nodes last
    drawNodes(graph.nodes);
}

// Layout nodes linearly, sorted by group
function linearLayout(nodes) {

    let newWidth = height;
    // used to scale node index to x position
    var xscale = d3.scale.linear()
        .domain([0, nodes.length - 1])
        .range([margin, newWidth - margin]);

    var yscale = d3.scale.linear()
        .domain([0, nodes.length - 1])
        .range([radius, height - margin - radius]);

    // calculate pixel location for each node
    nodes.forEach(function (d, i) {
        d.x = xscale(i);
        d.y = yfixed;
    });
}

// Draws nodes on plot
function drawNodes(nodes) {
    // used to assign nodes color by group
    //    var color = d3.scale.category10();
    let colorArray = ['#f5ee57', '#f8b74d', '#fb5152', '#d60005'];

    let max = d3.max(nodes, function (node) {
        return node.data.count;
    });

    let min = d3.min(nodes, function (node) {
        return node.data.count;
    });

    let nodeScale = d3.scale.linear().domain([min, max]).range([6, radius]);
    let nodeColorScale = d3.scale.quantize().domain([min, max]).range(colorArray);


    var nodeEnter = d3.select("#plot").selectAll(".node")
        .data(nodes)
        .enter();

    var nodeGroup = nodeEnter.append("g");

    nodeGroup.append("circle")
        .attr("class", "nodeOutline")
        .attr("cx", function (d, i) {
            return d.x;
        })
        .attr("cy", function (d, i) {
            return d.y;
        })
        .attr("r", function (d, i) {
            if (d.name == "start" || d.name == "end")
                return 0;
            return radius+2;
        })
        .attr('fill', 'white')
        .attr('stroke', 'black')
        .attr('stroke-width', '1px')
        .attr('stroke-dasharray', function (d) {
            if (d.data.type == "attribute") {
                return "4, 4";
            }
        })
        .attr('opacity', 0.4);

    nodeGroup.append("circle")
        .attr("class", "node")
        .attr("id", function (d, i) {
            return d.name;
        })
        .attr("cx", function (d, i) {
            return d.x;
        })
        .attr("cy", function (d, i) {
            return d.y;
        })
        .attr("r", function (d, i) {
            if (d.name == "start" || d.name == "end")
                return radius / 2;
            return nodeScale(d.data.count);
        })
        .style("fill", function (d, i) {
            if (d.name == "start" || d.name == "end") {
                return "#d1d3d4";
            }
            return nodeColorScale(d.data.count);
        })
        .each(function (d) {
            addTooltip(d3.select(this));
        })
        .on('mouseover', function (d, i) {
            let thisData = d;

            d3.selectAll('.tooltip').remove();
            d3.selectAll('.arch').transition().style('opacity', function (d) {
                return 0.04;
                //                return linkScale(d.data.count) * .25;
            });

            d3.selectAll('.node').style("fill", function (d, i) {
                return "#d1d3d4";
            });

            addTooltip(d3.select(this));
            d3.select(this).style('fill', function (d) {
                if (d.name == "start" || d.name == "end") {
                    return "#d1d3d4";
                }
                return nodeColorScale(d.data.count);

            });

            d3.selectAll('.nodeCount').filter(function (d) {
                return thisData == d;
            }).transition().style('opacity', 1);
            d3.selectAll('.arch').filter(function (d) {
                    if (d.source.name == thisData.name)
                        return true;
                    return false;
                }).transition().style('opacity', function (d) {

                    return linkScale(d.data.count) + .2;
                })
                .each(function (d) {
                    let nodeTarget = d.target.name;
                    d3.selectAll('.node').filter(function (d) {
                            return d.name == nodeTarget;
                        }).style("fill", function (d, i) {
                            if (d.name == "start" || d.name == "end") {
                                return "#d1d3d4";
                            }
                            return nodeColorScale(d.data.count);
                        })
                        .each(function (d) {
                            addTooltip(d3.select(this));
                        });
                });
        })
        .on('mouseout', function (d, i) {

            d3.selectAll('.nodeCount').transition().style('opacity', 0);
            d3.selectAll('.arch').transition().style('opacity', function (d) {
                return linkScale(d.data.count);
            });

            d3.selectAll('.node')
                .style("fill", function (d, i) {
                    if (d.name == "start" || d.name == "end") {
                        return "#d1d3d4";
                    }
                    return nodeColorScale(d.data.count);
                })
                .each(function (d) {
                    addTooltip(d3.select(this));
                });
        });

    nodeGroup.append("text")
        .text(function (d) {
            if (d.name == "start" || d.name == "end") {
                return "";
            } else return d3.format(',')(d.data.count);
        })
        .attr('class', 'nodeCount')
        .style('pointer-events', 'none')
        .style('text-anchor', 'middle')
        .style('opacity', 0)
        .attr('dy', '.35em')
        .attr('transform', function (d) {
            return 'translate(' + d.x + ',' + d.y + ')';
        });

}

// Draws nice arcs for each link on plot
function drawLinks(links) {

    let max = d3.max(links, function (edge) {
        return edge.data.count;
    });

    let min = d3.min(links, function (edge) {
        return edge.data.count;
    });
    linkScale = d3.scale.linear().domain([min, max]).range([0.2, 0.8]);

    let strokeScale = d3.scale.linear().domain([min, max]).range([4, radius]);
    // scale to generate radians (just for lower-half of circle)

    // add links
    d3.select("#plot").selectAll(".arch")
        .data(links)
        .enter()
        .append("path")
        .attr("class", "arch")
        .style('opacity', function (d) {
            //            console.log([d.data.weight, linkScale(d.data.weight)]);
            return linkScale(d.data.count);
        })
        .attr("transform", function (d, i) {
            // arc will always be drawn around (0, 0)
            // shift so (0, 0) will be between source and target
            var xshift = d.source.x + (d.target.x - d.source.x) / 2;
            //            var yshift = d.source.y + (d.target.y - d.source.y) / 2;
            var yshift = yfixed;
            return "translate(" + xshift + ", " + yshift + ")";
        })
        .style('fill', function (d) {
            //            if (d.data.direction == 'forward') {
            //                return 'green';
            //            } else return 'red';
            return 'steelgray';
        })
        .attr("d", shapedEdgePointy);

    function shapedEdge(d, i) {
        // get x distance between source and target
        var ydist = Math.abs(d.source.y - d.target.y);

        var arc = d3.svg.arc().innerRadius(ydist / 2 - strokeScale(d.data.count))
            .outerRadius(ydist / 2 + strokeScale(d.data.count));

        if (d.target.data.type == "action") {

            arc.startAngle(Math.PI);
            arc.endAngle(2 * Math.PI);
            return arc(d);
        } else {

            arc.startAngle(0);
            arc.endAngle(Math.PI);

            return arc(d);
        }

    }

    function shapedEdgePointy(d, i) {
        var areaArc = d3.svg.area()
            .interpolate("basis");

        // get x distance between source and target
        var rawXDist = d.source.x - d.target.x;
        var xdist = Math.abs(rawXDist);
        let strokeDisplacement = strokeScale(d.data.count);
        let arcPoints = [];

        let step = 67;
        let factor = 0.96;


        if (d.target.data.type == "action") {
            if (rawXDist < 0) {
                let tmp = strokeDisplacement;

                // Inner
                for (let i = Math.PI; i < 2 * Math.PI; i += Math.PI / step) {
                    let r = xdist / 2;
                    let theta = i;

                    let x = (r - tmp) * Math.cos(theta);
                    let y = (r - tmp) * Math.sin(theta);
                    tmp = tmp * factor;
                    arcPoints.push([x, y]);
                }
                // Outer
                for (let i = 2 * Math.PI; i > Math.PI; i -= Math.PI / step) {
                    let r = xdist / 2;
                    let theta = i;

                    let x = (r + tmp) * Math.cos(theta);
                    let y = (r + tmp) * Math.sin(theta);
                    tmp = tmp / factor;
                    arcPoints.push([x, y]);
                }
                //                arcPoints = [[0, -strokeScale(d.data.count)], [-ydist / 2 - strokeScale(d.data.count), ydist / 2], [0, ydist + 2], [0, ydist - 2], [-ydist / 2 + strokeScale(d.data.count), ydist / 2], [0, strokeScale(d.data.count)]];
            } else {
                // Outer
                let tmp = strokeDisplacement;
                for (let i = 2 * Math.PI; i > Math.PI; i -= Math.PI / step) {
                    let r = xdist / 2;
                    let theta = i;

                    let x = (r + tmp) * Math.cos(theta);
                    let y = (r + tmp) * Math.sin(theta);
                    tmp = tmp * factor;
                    arcPoints.push([x, y]);
                }

                // Inner
                for (let i = Math.PI; i < 2 * Math.PI; i += Math.PI / step) {
                    let r = xdist / 2;
                    let theta = i;

                    let x = (r - tmp) * Math.cos(theta);
                    let y = (r - tmp) * Math.sin(theta);
                    tmp = tmp / factor;
                    arcPoints.push([x, y]);
                }
                //                
                //                arcPoints = [[0, ydist - strokeScale(d.data.count)], [-ydist / 2 + strokeScale(d.data.count), ydist / 2], [0, -2], [0, 2], [-ydist / 2 - strokeScale(d.data.count), ydist / 2], [0, ydist + strokeScale(d.data.count)]];
            }
        } else {
            if (rawXDist < 0) {
                let tmp = strokeDisplacement;
                // Outer
                for (let i = Math.PI; i > 0; i -= Math.PI / step) {
                    let r = xdist / 2;
                    let theta = i;

                    let x = (r + tmp) * Math.cos(theta);
                    let y = (r + tmp) * Math.sin(theta);
                    tmp = tmp * factor;
                    arcPoints.push([x, y]);
                }

                // Inner
                for (let i = 0; i < Math.PI; i += Math.PI / step) {
                    let r = xdist / 2;
                    let theta = i;

                    let x = (r - tmp) * Math.cos(theta);
                    let y = (r - tmp) * Math.sin(theta);
                    tmp = tmp / factor;
                    arcPoints.push([x, y]);
                }

                //                arcPoints = [[0, -strokeScale(d.data.count)], [ydist / 2 + strokeScale(d.data.count), ydist / 2], [0, ydist + 2], [0, ydist - 2], [ydist / 2 - strokeScale(d.data.count), ydist / 2], [0, strokeScale(d.data.count)]];
            } else {
                let tmp = strokeDisplacement;

                // Inner
                for (let i = 0; i < Math.PI; i += Math.PI / step) {
                    let r = xdist / 2;
                    let theta = i;

                    let x = (r - tmp) * Math.cos(theta);
                    let y = (r - tmp) * Math.sin(theta);
                    tmp = tmp * factor;
                    arcPoints.push([x, y]);
                }

                // Outer
                for (let i = Math.PI; i > 0; i -= Math.PI / step) {
                    let r = xdist / 2;
                    let theta = i;

                    let x = (r + tmp) * Math.cos(theta);
                    let y = (r + tmp) * Math.sin(theta);
                    tmp = tmp / factor;
                    arcPoints.push([x, y]);
                }

                //                arcPoints = [[0, ydist - strokeScale(d.data.count)], [ydist / 2 - strokeScale(d.data.count), ydist / 2], [0, -2], [0, 2], [ydist / 2 + strokeScale(d.data.count), ydist / 2], [0, ydist + strokeScale(d.data.count)]];
            }
        }

        return areaArc(arcPoints);

    }
}
