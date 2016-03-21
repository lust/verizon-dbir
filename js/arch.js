/* GLOBALS */
'use strict';

var width = 1900; // width of svg image
var height = 20; // height of svg image
var margin = 20; // amount of margin around plot area
var pad = margin / 2; // actual padding amount
var radius = 10; // fixed node radius
var yfixed = pad + radius; // y position for all nodes
let linkScale;
var path = [{source: "start", target: "action.hacking"}, {source: "action.hacking", target: "attribute.integrity"}, {source: "attribute.integrity", target: "end"}];

d3.json("2016_all_supergraph.json", function (error, data) {
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

        if (data.direction == "forward") {
            output.edges.push({
                source: sourceNode,
                target: targetNode,
                data: data
            });
        } else {
            output.edges.push({
                source: targetNode,
                target: sourceNode,
                data: data
            });
        }

    }

    console.log(output);
    return output;
}

/* HELPER FUNCTIONS */

// Generates a tooltip for a SVG circle element based on its ID
function addTooltip(circle) {
    var x = parseFloat(circle.attr("cx"));
    var y = parseFloat(circle.attr("cy"));
    var r = parseFloat(circle.attr("r"));
    var text = circle.attr("id");

    var tooltip = d3.select("#plot")
        .append("text")
        .text(text)
        .attr("x", x)
        .attr("y", y)
        .attr("dy", -r * 2)
        .attr("class", "tooltip");

    var offset = tooltip.node().getBBox().width / 2;

    if ((x - offset) < 0) {
        tooltip.attr("text-anchor", "start");
        tooltip.attr("dx", -r);
    } else if ((x + offset) > (width - margin)) {
        tooltip.attr("text-anchor", "end");
        tooltip.attr("dx", r);
    } else {
        tooltip.attr("text-anchor", "middle");
        tooltip.attr("dx", 0);
    }
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
    var plot = svg.append("g")
        .attr("id", "plot")
        .attr("transform", "translate(" + pad + ", " + pad + ")");

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
    var xscale = d3.scale.linear()
        .domain([0, nodes.length - 1])
        .range([radius, width - margin - radius]);

    // calculate pixel location for each node
    nodes.forEach(function (d, i) {
        d.x = xscale(i);
        d.y = yfixed;
    });
}

// Draws nodes on plot
function drawNodes(nodes) {
    // used to assign nodes color by group
    var color = d3.scale.category10();

    let max = d3.max(nodes, function (node) {
        return node.data.weight;
    });

    let min = d3.min(nodes, function (node) {
        return node.data.weight;
    });

    let nodeScale = d3.scale.linear().domain([min, max]).range([5, 10]);


    
    d3.select("#plot").selectAll(".node")
        .data(nodes)
        .enter()
        .append("circle")
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
                return 10;
            return nodeScale(d.data.weight);
        })
        .style("fill", function (d, i) {
            return color(d.data.type);
        })
        .on("mouseenter", function (d, i) {
            addTooltip(d3.select(this));

            let targetNodes = [];
            d3.selectAll(".link")
                .style('opacity', function (d) {
                    return linkScale(d.data.weight) * .05;
                });

            d3.selectAll(".link")
                .filter(function (linkData) {
                    return linkData.source.name == d.name;
                })
                .each(function (linkData) {
                    targetNodes.push(linkData.target);
                })
//                .style("stroke-width", '5')            
                .style('opacity', function (d) {
                    return linkScale(d.data.weight);
                });

            targetNodes.forEach(function (node) {
                //                console.log(node.name);
                let circle = d3.selectAll(".node").filter(function (d) {
                    return d.name == node.name;
                })[0][0];
                //                console.log(circle);
                addTooltip(d3.select(circle));
            });

        })
        .on("mouseleave", function (d, i) {
            d3.selectAll(".tooltip").remove();
            d3.selectAll(".link").style('stroke-width', function (d) {
                return 0;
                //                return d.data.count / 500;
            }).style('opacity', function (d) {
                return linkScale(d.data.weight)*.25;
            });
        })
        .on("click", function (d, i) {
//            let targetNodes = [];
//            d3.selectAll(".link")
//                .style('opacity', function (d) {
//                    return linkScale(d.data.count) * .5;
//                });
//
//            d3.selectAll(".link")
//                .filter(function (linkData) {
//                    return linkData.source.name == d.name;
//                })
//                .each(function (linkData) {
//                    targetNodes.push(linkData.target);
//                })
//                .style("stroke-width", '10')
//                .style('opacity', function (d) {
//                    return linkScale(d.data.count) * 1.5;
//                })
//                .style('stroke-opacity', function (d) {
//                    return linkScale(d.data.count) * 1.5;
//                });
//
//            targetNodes.forEach(function (node) {
//                //                console.log(node.name);
//                let circle = d3.selectAll(".node").filter(function (d) {
//                    return d.name == node.name;
//                })[0][0];
//                //                console.log(circle);
//                addTooltip(d3.select(circle));
//            });
//
//            path.forEach(function (path) {
//                //               d3.select(path). 
//            });

        });
}

// Draws nice arcs for each link on plot
function drawLinks(links) {

    let max = d3.max(links, function (edge) {
        return edge.data.weight;
    });

    let min = d3.min(links, function (edge) {
        return edge.data.weight;
    });
    linkScale = d3.scale.linear().domain([min, max]).range([0.1, 1]);

   // scale to generate radians (just for lower-half of circle)
    var radians = d3.scale.linear()
        .range([Math.PI/2, 3* Math.PI/2]);

    // path generator for arcs (uses polar coordinates)
    var arc = d3.svg.line.radial()
        .interpolate("basis")
        .tension(0)
        .angle(function(d) { return radians(d); });

    var areaArc = d3.svg.area()
        .interpolate("cardinal")
        .tension(0);


    // add links
    d3.select("#plot").selectAll(".link")
        .data(links)
        .enter()
        .append("path")
        .attr("class", "link")
        .style('opacity', function (d) {
//            console.log([d.data.weight, linkScale(d.data.weight)]);
            return linkScale(d.data.weight)*.25;
        })        
      .attr("transform", function(d, i) {
            // arc will always be drawn around (0, 0)
            // shift so (0, 0) will be between source and target
            var xshift = d.source.x;
            var yshift = yfixed;
            return "translate(" + xshift + ", " + yshift + ")";
        })
        .attr("d", shapedEdge);
 
   function shapedEdge(d, i) {
                    // get x distance between source and target
            var xdist = d.target.x - d.source.x;

            
            let arcPoints = [[-4,0], [xdist/2, Math.abs(xdist/3+2)], [xdist, 0],  [xdist/2, Math.abs(xdist/3-2)], [4, 0]];
       
            return areaArc(arcPoints);

    }
}

function showPath() {
    highlightPath(path);
}

function highlightPath(path) {
    d3.selectAll(".link")
                .style('opacity', function (d) {
                    return linkScale(d.data.weight) * .05;
                });
    
    path.forEach((pathElement) => {
        let link = d3.selectAll('.link').filter((d) => {
            return (d.source.name == pathElement.source && d.target.name == pathElement.target);
        });
        link.transition().style('fill', 'red').style('opacity', d => linkScale(d.data.weight));
        
        let startNode = d3.selectAll('.node').filter(d => d.name == pathElement.source);
        addTooltip(startNode);
    });
}