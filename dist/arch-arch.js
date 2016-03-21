/* GLOBALS */
'use strict';

var width = 1600; // width of svg image
var height = document.documentElement.clientHeight * 1.5; // height of svg image
var margin = 40; // amount of margin around plot area
var pad = margin / 2; // actual padding amount
var radius = 50; // fixed node radius
var yfixed = pad + radius; // y position for all nodes
var xfixed = width / 2;
var linkScale = void 0;

d3.json("finaldata/2016_supergraph.json", function (error, data) {
    if (error) return console.warn(error);

    var processed = processData(data);
    arcDiagram(processed);
});

function processData(data) {
    var output = {
        nodes: [],
        edges: []
    };
    var graph = data.graphml.graph;

    var startNode = void 0,
        endNode = void 0;
    // Build nodes
    for (var i = 0; i < graph.node.length; i++) {
        var node = graph.node[i];

        var _data = {};
        for (var j = 0; j < node.data.length; j++) {
            var datum = node.data[j];
            if (datum["@key"] == "d0") _data.count = +datum["#text"];else if (datum["@key"] == "d1") _data.type = datum["#text"];else if (datum["@key"] == "d2") _data.subType = datum["#text"];else if (datum["@key"] == "d3") _data.weight = +datum["#text"];else if (datum["@key"] == "d4") _data.label = datum["#text"];
        }

        var nodeObj = {
            "name": node["@id"],
            "data": _data
        };
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
    var map = {
        action: 0,
        attribute: 1
    };
    output.nodes.sort(function (a, b) {
        //        console.log(a.data.type-b.data.type);
        return map[a.data.type] - map[b.data.type];
    });

    // adds start and end nodes
    output.nodes.unshift(startNode);
    output.nodes.push(endNode);

    // Build edges

    var _loop = function _loop(_i) {
        var edge = graph.edge[_i];

        // Find Source
        var sourceName = edge["@source"];
        var sourceNode = output.nodes.filter(function (node) {
            return node.name == sourceName;
        })[0];

        // Find Target
        var targetName = edge["@target"];
        var targetNode = output.nodes.filter(function (node) {
            return node.name == targetName;
        })[0];

        var data = {};

        for (var _j = 0; _j < edge.data.length; _j++) {
            var _datum = edge.data[_j];

            if (_datum["@key"] == "d5") data.count = +_datum["#text"];else if (_datum["@key"] == "d6") data.direction = _datum["#text"];else if (_datum["@key"] == "d7") data.weight = +_datum["#text"];else if (_datum["@key"] == "d8") data.label = _datum["#text"];
        }

        if (sourceNode.name == targetNode.name) return "continue";

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
    };

    for (var _i = 0; _i < graph.edge.length; _i++) {
        var _ret = _loop(_i);

        if (_ret === "continue") continue;
    }

    //    console.log(output);
    return output;
}

/* HELPER FUNCTIONS */

// Generates a tooltip for a SVG circle element based on its ID
function addTooltip(circle) {
    var x = parseFloat(circle.attr("cx")) + 40;
    var y = parseFloat(circle.attr("cy")) - 40;
    var r = 10;
    var text = circle.attr("id");

    var split = text.split('.');
    if (split.length == 1) text = split[0];else text = split[1];
    var tooltip = d3.select("#plot").append("text").text(text.toUpperCase()).attr("transform", "translate(" + x + "," + y + ")rotate(-45)").attr("class", function () {
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
    var svg = d3.select("body").append("svg").attr("id", "arc").attr("width", width).attr("height", height + pad);

    // draw border around svg image
    // svg.append("rect")
    //     .attr("class", "outline")
    //     .attr("width", width)
    //     .attr("height", height);

    // create plot area within svg image
    var plot = svg.append("g").attr("id", "plot").attr("transform", "translate(" + pad + ", " + pad + ")");

    var wp = (width + margin) / 2 + width * .4;
    svg.append("text").text("LINKS TO ACTIONS").attr('class', 'label').style('text-anchor', 'middle').attr('transform', 'translate(' + wp + ',' + height / 2 + ')rotate(-90)');

    wp = (width + margin) / 2 - width * .4;
    svg.append("text").text("LINKS TO ATTRIBUTES").attr('class', 'label').style('text-anchor', 'middle').attr('transform', 'translate(' + wp + ',' + height / 2 + ')rotate(90)');

    var header = svg.append("text").attr('class', 'heading').attr('transform', 'translate(100, 50)');

    header.append("tspan").text("2015 DBIR");

    header.append("tspan").text("ATTACK GRAPH").attr("x", 0).attr("y", 50);
    // must be done AFTER links are fixed
    linearLayout(graph.nodes);

    // draw links first, so nodes appear on top
    drawLinks(graph.edges);

    // draw nodes last
    drawNodes(graph.nodes);
}

// Layout nodes linearly, sorted by group
function linearLayout(nodes) {

    // used to scale node index to x position
    var xscale = d3.scale.linear().domain([0, nodes.length - 1]).range([radius, width - margin - radius]);

    var yscale = d3.scale.linear().domain([0, nodes.length - 1]).range([radius + pad, height - margin - radius]);

    // calculate pixel location for each node
    nodes.forEach(function (d, i) {
        d.x = xfixed;
        d.y = yscale(i);
    });
}

// Draws nodes on plot
function drawNodes(nodes) {
    // used to assign nodes color by group
    //    var color = d3.scale.category10();
    var colorArray = ['#f5ee57', '#f8b74d', '#fb5152', '#d60005'];

    var max = d3.max(nodes, function (node) {
        return node.data.count;
    });

    var min = d3.min(nodes, function (node) {
        return node.data.count;
    });

    var nodeScale = d3.scale.linear().domain([min, max]).range([6, 50]);
    var nodeColorScale = d3.scale.quantize().domain([min, max]).range(colorArray);

    var nodeEnter = d3.select("#plot").selectAll(".node").data(nodes).enter();

    var nodeGroup = nodeEnter.append("g");

    nodeGroup.append("circle").attr("class", "nodeOutline").attr("cx", function (d, i) {
        return d.x;
    }).attr("cy", function (d, i) {
        return d.y;
    }).attr("r", function (d, i) {
        if (d.name == "start" || d.name == "end") return 0;
        return 50;
    }).attr('fill', 'white').attr('stroke', 'black').attr('stroke-width', '1px').attr('stroke-dasharray', function (d) {
        if (d.data.type == "attribute") {
            return "4, 4";
        }
    }).attr('opacity', 0.25);

    nodeGroup.append("circle").attr("class", "node").attr("id", function (d, i) {
        return d.name;
    }).attr("cx", function (d, i) {
        return d.x;
    }).attr("cy", function (d, i) {
        return d.y;
    }).attr("r", function (d, i) {
        if (d.name == "start" || d.name == "end") return 20;
        return nodeScale(d.data.count);
    }).style("fill", function (d, i) {
        if (d.name == "start" || d.name == "end") {
            return "#d1d3d4";
        }
        return nodeColorScale(d.data.count);
    }).each(function (d) {
        addTooltip(d3.select(this));
    }).on('mouseover', function (d, i) {
        var thisData = d;

        d3.selectAll('.tooltip').remove();
        d3.selectAll('.arch').style('opacity', function (d) {
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
        d3.selectAll('.arch').filter(function (d) {
            if (d.source.name == thisData.name) return true;
            return false;
        }).style('opacity', function (d) {

            return linkScale(d.data.count) + .2;
        }).each(function (d) {
            var nodeTarget = d.target.name;
            d3.selectAll('.node').filter(function (d) {
                return d.name == nodeTarget;
            }).style("fill", function (d, i) {
                if (d.name == "start" || d.name == "end") {
                    return "#d1d3d4";
                }
                return nodeColorScale(d.data.count);
            }).each(function (d) {
                addTooltip(d3.select(this));
            });
        });
    }).on('mouseout', function (d, i) {
        d3.selectAll('.arch').style('opacity', function (d) {
            return linkScale(d.data.count);
        });

        d3.selectAll('.node').style("fill", function (d, i) {
            if (d.name == "start" || d.name == "end") {
                return "#d1d3d4";
            }
            return nodeColorScale(d.data.count);
        }).each(function (d) {
            addTooltip(d3.select(this));
        });
    });
}

// Draws nice arcs for each link on plot
function drawLinks(links) {

    var max = d3.max(links, function (edge) {
        return edge.data.count;
    });

    var min = d3.min(links, function (edge) {
        return edge.data.count;
    });
    linkScale = d3.scale.linear().domain([min, max]).range([0.2, 0.8]);

    var strokeScale = d3.scale.linear().domain([min, max]).range([4, 50]);
    // scale to generate radians (just for lower-half of circle)

    // add links
    d3.select("#plot").selectAll(".arch").data(links).enter().append("path").attr("class", "arch").style('opacity', function (d) {
        //            console.log([d.data.weight, linkScale(d.data.weight)]);
        return linkScale(d.data.count);
    }).attr("transform", function (d, i) {
        // arc will always be drawn around (0, 0)
        // shift so (0, 0) will be between source and target
        var xshift = xfixed;
        var yshift = d.source.y + (d.target.y - d.source.y) / 2;
        return "translate(" + xshift + ", " + yshift + ")";
    }).style('fill', function (d) {
        //            if (d.data.direction == 'forward') {
        //                return 'green';
        //            } else return 'red';
        return 'steelgray';
    }).attr("d", shapedEdgePointy);

    function shapedEdge(d, i) {
        // get x distance between source and target
        var ydist = Math.abs(d.source.y - d.target.y);

        var arc = d3.svg.arc().innerRadius(ydist / 2 - strokeScale(d.data.count)).outerRadius(ydist / 2 + strokeScale(d.data.count));

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
        var areaArc = d3.svg.area().interpolate("basis");

        // get y distance between source and target
        var rawYDist = d.source.y - d.target.y;
        var ydist = Math.abs(d.source.y - d.target.y);
        var strokeDisplacement = strokeScale(d.data.count);
        var arcPoints = [];

        var step = 67;
        var factor = 0.96;

        if (d.target.data.type == "action") {
            if (rawYDist < 0) {
                var tmp = strokeDisplacement;

                // Inner
                for (var _i2 = 3 / 2 * Math.PI; _i2 > 1 / 2 * Math.PI; _i2 -= Math.PI / step) {
                    var r = ydist / 2;
                    var theta = _i2;

                    var x = (r - tmp) * Math.cos(theta);
                    var y = (r - tmp) * Math.sin(theta);
                    tmp = tmp * factor;
                    arcPoints.push([x, y]);
                }
                // Outer
                for (var _i3 = Math.PI / 2; _i3 < 3 / 2 * Math.PI; _i3 += Math.PI / step) {
                    var _r = ydist / 2;
                    var _theta = _i3;

                    var _x = (_r + tmp) * Math.cos(_theta);
                    var _y = (_r + tmp) * Math.sin(_theta);
                    tmp = tmp / factor;
                    arcPoints.push([_x, _y]);
                }
                //                arcPoints = [[0, -strokeScale(d.data.count)], [-ydist / 2 - strokeScale(d.data.count), ydist / 2], [0, ydist + 2], [0, ydist - 2], [-ydist / 2 + strokeScale(d.data.count), ydist / 2], [0, strokeScale(d.data.count)]];
            } else {
                    // Outer
                    var _tmp = strokeDisplacement;
                    for (var _i4 = Math.PI / 2; _i4 < 3 / 2 * Math.PI; _i4 += Math.PI / step) {
                        var _r2 = ydist / 2;
                        var _theta2 = _i4;

                        var _x2 = (_r2 + _tmp) * Math.cos(_theta2);
                        var _y2 = (_r2 + _tmp) * Math.sin(_theta2);
                        _tmp = _tmp * factor;
                        arcPoints.push([_x2, _y2]);
                    }

                    // Inner
                    for (var _i5 = 3 / 2 * Math.PI; _i5 > 1 / 2 * Math.PI; _i5 -= Math.PI / step) {
                        var _r3 = ydist / 2;
                        var _theta3 = _i5;

                        var _x3 = (_r3 - _tmp) * Math.cos(_theta3);
                        var _y3 = (_r3 - _tmp) * Math.sin(_theta3);
                        _tmp = _tmp / factor;
                        arcPoints.push([_x3, _y3]);
                    }
                    //               
                    //                arcPoints = [[0, ydist - strokeScale(d.data.count)], [-ydist / 2 + strokeScale(d.data.count), ydist / 2], [0, -2], [0, 2], [-ydist / 2 - strokeScale(d.data.count), ydist / 2], [0, ydist + strokeScale(d.data.count)]];
                }
        } else {
                if (rawYDist < 0) {
                    var _tmp2 = strokeDisplacement;
                    // Outer
                    for (var _i6 = -Math.PI / 2; _i6 < Math.PI / 2; _i6 += Math.PI / step) {
                        var _r4 = ydist / 2;
                        var _theta4 = _i6;

                        var _x4 = (_r4 + _tmp2) * Math.cos(_theta4);
                        var _y4 = (_r4 + _tmp2) * Math.sin(_theta4);
                        _tmp2 = _tmp2 * factor;
                        arcPoints.push([_x4, _y4]);
                    }

                    // Inner
                    for (var _i7 = Math.PI / 2; _i7 > -Math.PI / 2; _i7 -= Math.PI / step) {
                        var _r5 = ydist / 2;
                        var _theta5 = _i7;

                        var _x5 = (_r5 - _tmp2) * Math.cos(_theta5);
                        var _y5 = (_r5 - _tmp2) * Math.sin(_theta5);
                        _tmp2 = _tmp2 / factor;
                        arcPoints.push([_x5, _y5]);
                    }

                    //                arcPoints = [[0, -strokeScale(d.data.count)], [ydist / 2 + strokeScale(d.data.count), ydist / 2], [0, ydist + 2], [0, ydist - 2], [ydist / 2 - strokeScale(d.data.count), ydist / 2], [0, strokeScale(d.data.count)]];
                } else {
                        var _tmp3 = strokeDisplacement;

                        // Inner
                        for (var _i8 = Math.PI / 2; _i8 > -Math.PI / 2; _i8 -= Math.PI / step) {
                            var _r6 = ydist / 2;
                            var _theta6 = _i8;

                            var _x6 = (_r6 - _tmp3) * Math.cos(_theta6);
                            var _y6 = (_r6 - _tmp3) * Math.sin(_theta6);
                            _tmp3 = _tmp3 * factor;
                            arcPoints.push([_x6, _y6]);
                        }

                        // Outer
                        for (var _i9 = -Math.PI / 2; _i9 < Math.PI / 2; _i9 += Math.PI / step) {
                            var _r7 = ydist / 2;
                            var _theta7 = _i9;

                            var _x7 = (_r7 + _tmp3) * Math.cos(_theta7);
                            var _y7 = (_r7 + _tmp3) * Math.sin(_theta7);
                            _tmp3 = _tmp3 / factor;
                            arcPoints.push([_x7, _y7]);
                        }

                        //                arcPoints = [[0, ydist - strokeScale(d.data.count)], [ydist / 2 - strokeScale(d.data.count), ydist / 2], [0, -2], [0, 2], [ydist / 2 + strokeScale(d.data.count), ydist / 2], [0, ydist + strokeScale(d.data.count)]];
                    }
            }

        return areaArc(arcPoints);
    }
}

