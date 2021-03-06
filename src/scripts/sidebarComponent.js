import '../styles/index.scss';
import * as d3 from "d3";

import {dataMaster, nestedData, collapsed} from './index';
import {getScales, getLatestData} from './filterComponent';
import {getNested} from './pathCalc';
import { dropDown } from './buttonComponents';
import { updateRanking, changeTrait } from './pairView';
import { pairPaths, maxTimeKeeper, scalingValues } from './dataFormat';
import { cladesGroupKeeper, chosenCladesGroup, growSidebarRenderTree } from './cladeMaker';
import { valueParam } from './toolbarComponent';


export function buildTreeStructure(paths, edges){
   
    let root = paths[0][0];
    let nestedData = getNested(root, edges);
    return nestedData;
}

export function traitColorDropDown(scales, sidebar, renderCallback, addedCall){

    let optionArray  = reduce2DropArray(scales);

    let dropOptions = dropDown(sidebar, optionArray, `Color By Trait`,'show-drop-div-sidebar');
    dropOptions.on('click', (d, i, n)=> {
        if(d.type === 'discrete'){
            renderCallback(d, true, false);
            d3.select('.dropdown.show-drop-div-sidebar').select('button').text(`Colored by ${d.field}`);
            if(addedCall != null) addedCall(d);
        }else if(d.type === 'continuous'){
            renderCallback(d, true, false);
            d3.select('.dropdown.show-drop-div-sidebar').select('button').text(`Colored by ${d.field}`);
            if(addedCall != null) addedCall(d);
        }else{
             renderCallback(null, true, false)
            d3.select('.dropdown.show-drop-div-sidebar').select('button').text(`Color By Value`);
        }
    sidebar.select('#show-drop-div-sidebar').classed('show', false);
    });

    return dropOptions;

}

export function reduce2DropArray(startArray){
    return  startArray.reduce(function(array, scale){
        array.push(scale);
        return array; 
    }, [{'field':'None'}]); 
}

export function renderTreeButtons(normedPaths){

    let scales = getScales();
    let sidebar = d3.select('#sidebar');

    ///SIDBAR STUFF
    let buttonWrap = sidebar.append('div').classed('button-wrap', true);
   
    traitColorDropDown(scales, buttonWrap, renderTree), null;

    buttonWrap.select('button').style('font-size', '12px');
    let phenoOptions = reduce2DropArray(scales.filter(f=> f.type != 'discrete'));
 
      ///BUTTON FOR PHENOGRAM VIEW. MAYBE MOVE THIS TO SIDEBAR
    let phenogramButton = d3.select('#sidebar').select('.button-wrap').append('button').text('Phenogram').style('font-size', '12px');
    phenogramButton.classed('btn btn-outline-secondary', true).attr('id', 'view-pheno'); 
    phenogramButton.on('click', ()=> {
          if(phenogramButton.text() === 'Phenogram'){

              phenogramButton.text('View Phylogeny');
              changeTrait(phenoOptions, normedPaths, null);
              
              renderTree(null, true, d3.select('.attr-drop.dropdown').select('button').attr('value'));

          }else{
            ////ADD THE HIDE BUTTON HERE 
            let view = d3.select('.dropdown.change-view').select('button').text();
           
            if(view != "Pair View"){
                d3.select('.dropdown.attr-drop').remove();
            }
            renderTree(null, true, false);
            phenogramButton.text('Phenogram');

          }
    });

    let cladeButton = buttonWrap.append('button').attr('id', 'clade-maker');
    cladeButton.attr('class', 'btn btn-outline-secondary').text('Subtree View').style('font-size', '12px');
    cladeButton.on('click', ()=> growSidebarRenderTree(null));
}

export function tooltipTreeNode(data, index, nodeArray, attribute){

    let paths = d3.select('#main-path-view').selectAll('.paths');
    let points = d3.select('#main-summary-view').selectAll('.branch-points');
    points.filter(f=> f.node === data.data.node).classed('selected', true);

    let selectedPaths = paths.filter(path=> {
        let nodes = path.map(m=> m.node);
        return nodes.indexOf(data.data.node) > -1;
    }).classed('hover', true);
    selectedPaths.selectAll('g').filter(g=> g.node === data.data.node).classed('selected', true);
    d3.select(nodeArray[index]).classed('selected-branch', true);

    if(data.data.leaf === true){
        let tool = d3.select('#tooltip');
        tool.transition()
        .duration(200)
        .style("opacity", .9);
    
        if(attribute != null){

            let access = attribute.type === 'continuous' ? 'realVal' : attribute.field;

            tool.html(`
            ${data.data.name.charAt(0).toUpperCase() + data.data.name.slice(1)} <br/>
            ${attribute.field}: ${data.data.attributes[attribute.field].values[access]}
            `);

        }else{
            tool.html(`${data.data.name.charAt(0).toUpperCase() + data.data.name.slice(1)}`);
        }
      
        tool.style("left", (d3.event.pageX + 6) + "px")
        .style("top", (d3.event.pageY - 18) + "px");
        tool.style('height', 'auto');

   
    }

}

function uncollapseSub(d){
    d.children = d._children;
    d._children = null;
    if(d.children){
        d.children.map(c=> uncollapseSub(c));
    }    
}

function collapseSub(d){
    if(d.children) {
        d._children = d.children
        d._children.forEach(collapseSub)
        d.children = null
    }  
}

function collapseTree(treeData){

    let leaves = getLeaves(treeData, []);

    return stepDown(treeData);

    function stepDown(node){
        let leaves = getLeaves(node, []);
        
        let ids = new Set(leaves.map(m=> m.data.attributes.Clade.values.Clade));
        if(ids.size > 1){
            node.children.map(n=> stepDown(n))
        }else{
            node.branchPoint = true;
            node.clade = Array.from(ids)[0]
            collapseSub(node);
            return node;
        }
        return node;
    }
    
    function getLeaves(node, array){
        if(node.children != undefined ){
            node.children.map(n=> getLeaves(n, array))
        }else{
            array.push(node);
        };
        return array;
    }
}

export function assignPosition(node, position) {
    if (node.children === undefined || node.children === null){
        
        position = position + 1.5;
        node.position = position;
        return position;
    }else{
        let positionArray = []
        node.children.forEach((child) => {
            position = assignPosition(child, position);
            positionArray.push(position);
        });
        node.options = positionArray;
        node.position = d3.max(positionArray);
        return position;
    }
}

export function addingEdgeLength(edge, data){
    data.combEdge = data.edgeLength + edge;
    if(data.children){
        data.children.forEach(chil=> {
            addingEdgeLength(data.combEdge, chil);
        });
    }
}

export function renderTree(att, uncollapse, pheno){

    let sidebar = d3.select('#sidebar');

    const dimensions =  {
        margin : {top: 10, right: 90, bottom: 50, left: 20},
        width : 260,
        height : 720,
        lengthHeight: 850,
    }

    // declares a tree layout and assigns the size
    var treemap = d3.tree()
   // .size([dimensions.height, dimensions.width]);
   
    addingEdgeLength(0, nestedData[nestedData.length - 1]);
    
    //  assigns the data to a hierarchy using parent-child relationships
    var treenodes = d3.hierarchy(nestedData[nestedData.length - 1]);

    // maps the node data to the tree layout
    treenodes = treemap(treenodes);

    let groupedBool = d3.select('#show-drop-div-group').attr('value');

    let sidebarTest = sidebar.select('svg');
    let treeSvg = sidebarTest.empty() ? sidebar.append("svg") : sidebarTest;
    treeSvg.classed('tree-svg', true);
    treeSvg.attr("width", dimensions.width + dimensions.margin.left + dimensions.margin.right)
    .attr("height", dimensions.height + dimensions.margin.top + dimensions.margin.bottom);

    let gTest = treeSvg.select('g.tree-g');
    let g = gTest.empty() ? treeSvg.append("g").classed('tree-g', true) : gTest;
    g.attr("transform",
      "translate(" + dimensions.margin.left + "," + dimensions.margin.top + ")");

    if(groupedBool === "ungrouped" && uncollapse === false){
        if((cladesGroupKeeper.length > 0) && (chosenCladesGroup[chosenCladesGroup.length - 1].field != 'Clade Attribute)')){
            let newNodes = collapseTree(treenodes);
         
            updateTree(newNodes, dimensions, treeSvg, g, att, pheno);
        }else{
          
            updateTree(treenodes, dimensions, treeSvg, g, att, pheno);
        }
        
    }else{
        
        ////Break this out into other nodes////
        updateTree(treenodes, dimensions, treeSvg, g, att, pheno);
    }
    /////END TREE STUFF
    ///////////
}

export function findDepth(node, array){
    function stepDown(n){
        if(n.children != null){
            n.children.forEach(child=> {
                stepDown(child);
            })
        }else{
            array.push(n);
        }
    }
    stepDown(node);
    return array;
}

export function updateTree(treenodes, dimensions, treeSvg, g, attrDraw, pheno){

    
    let dataSet = getLatestData();
    let move = dataSet.length > 200 ? 370 : 375;

    let length = true;
    let uncollapse = true;

    d3.select('.pheno-y-axis').remove();
    d3.select('.pheno-x-axis').remove();
    
    assignPosition(treenodes, 0);

    let branchCount = findDepth(treenodes, []);
    let xScale = d3.scaleLinear().domain([0, maxTimeKeeper[maxTimeKeeper.length - 1]]).range([0, dimensions.width]).clamp(true);
    let yScale = d3.scaleLinear().range([dimensions.height, 0]).domain([0, 1]);

    g.attr('transform', `translate(20, ${move})`);
    treeSvg.attr('height', 1100);
    yScale.range([700, 0]).domain([0, branchCount.length]);
    xScale.range([0, dimensions.width + 10]);

    if(pheno){

        if(pheno === 'None'){
            let scales = getScales().filter(f=> f.type === 'continuous');
            pheno = scales[0].field;
        }

        treeSvg.attr('height', 800);
        let min = scalingValues(treenodes.data.attributes[pheno].scales.min);
        let max = scalingValues(treenodes.data.attributes[pheno].scales.max);
       
        //xScale.domain(treenodes.data.attributes[pheno].scales.yScale.domain())
        xScale.domain([min, max]);
        yScale.domain([0, maxTimeKeeper[maxTimeKeeper.length - 1]]).range([0, 600]);
        
    }

    // adds the links between the nodes
    let link = g.selectAll(".link")
    .data( treenodes.descendants().slice(1))
    .join("path")
    .attr("class", "link");

    link.transition()
    .duration(500)
    .attr("d", function(d) {
        if((length && pheno === undefined) || (length && pheno === false)){
           return "M" + xScale(d.data.combEdge) + "," + yScale(d.position)
           + "C" + (xScale(d.data.combEdge) + xScale(d.parent.data.combEdge)) / 2 + "," + yScale(d.position)
           + " " + (xScale(d.parent.data.combEdge)) + "," + yScale(d.position)
           + " " + xScale(d.parent.data.combEdge) + "," + yScale(d.parent.position);
        }else{
            return "M" + xScale(d.data.attributes[pheno].values[valueParam]) + "," + yScale(d.data.combEdge)
            + " " + xScale(d.parent.data.attributes[pheno].values[valueParam]) + "," + yScale(d.parent.data.combEdge);
        }       
    });

    if(pheno){
        
        link.style('opacity', 0.3);
        g.attr('transform', 'translate(30, 50)');

        let x = xScale;
        x.range([0, (dimensions.width+20)]);
        let min = scalingValues(treenodes.data.attributes[pheno].scales.min);
        let max = scalingValues(treenodes.data.attributes[pheno].scales.max);
       
        //xScale.domain(treenodes.data.attributes[pheno].scales.yScale.domain())
        x.domain([min, max]);
   
        let xAxis = d3.axisBottom(x);
        g.append('g').classed('pheno-x-axis', true).call(xAxis).attr('transform', 'translate(0, 610)').select('path').attr('stroke-width', 0);

        let y = d3.scaleLinear().domain([0,maxTimeKeeper[maxTimeKeeper.length - 1]]).range([0, 600-20]);
        let yFlipped = d3.scaleLinear().domain([maxTimeKeeper[maxTimeKeeper.length - 1], 0]).range([0, 600]);
        let yAxis = d3.axisLeft(yFlipped);
        g.append('g').classed('pheno-y-axis', true).call(yAxis).attr('transform', 'translate(0, 2)').select('path').attr('stroke-width', 0);;
    }

    // adds each node as a group
    var node = g.selectAll(".node")
    .data(treenodes.descendants(), d => d.data.node)
    .join("g")
    .attr("class", function(d) { 
    return "node" + 
    (d.children ? " node--internal" : " node--leaf"); });

    // adds the circle to the node
    node.selectAll('circle').data(d=> [d]).join("circle")
      .attr("r", 3);

    node.transition()
    .duration(500)
    .attr("transform", function(d) { 
        if(length && pheno === undefined || pheno === false){
            return "translate(" + xScale(d.data.combEdge) + "," + yScale(d.position) + ")"; 
        }else{

           return "translate(" + (xScale(d.data.attributes[pheno].values[valueParam]) - 5) + "," + yScale(d.data.combEdge) + ")"; 
        }
    });

    if(attrDraw != null){
        
        let leaves = node.filter(n=> n.data.leaf === true);
        let notleaves = node.filter(n=> n.data.leaf != true);

        if(attrDraw.type === 'discrete'){
            attrDraw.stateColors.forEach(att=> {
                let circ = leaves.filter(f=> {
                    return att.state.includes(f.data.attributes[attrDraw.field].states.state)
                }).select('circle');
                circ.attr('fill', att.color);
                notleaves.selectAll('circle').attr('fill', 'gray');
            });
        }else{
            let scale = attrDraw.yScale;
            scale.range(['#fff', '#E74C3C']);
            leaves.select('circle').attr('fill', (d, i)=> {
                return scale(d.data.attributes[attrDraw.field].values[valueParam]);
            });
        }
    }else{
        node.selectAll('circle').attr('fill', 'gray');
    }

    node.on('mouseover', (d, i, n)=> {

        tooltipTreeNode(d, i, n, attrDraw);

    }).on('mouseout', (d, i, n)=> {
        d3.selectAll('.paths.hover').classed('hover', false);
        d3.selectAll('g.selected').classed('selected', false);
        d3.select(n[i]).classed('selected-branch', false);

        let tool = d3.select('#tooltip');
        tool.transition()
          .duration(500)
          .style("opacity", 0);
    });
    let leaves = node.filter(f=> f.data.children.length == 0);

    node.selectAll('text').remove();
    node.selectAll('.triangle').remove();

    let branchNodes = node.filter(n=> n.branchPoint === true);

    branchNodes.each((b, i, n)=> {
        if(b.children === null){
            let triangle = d3.select(n[i]).append('path').classed('triangle', true).attr('d', d3.symbol().type(d3.symbolTriangle).size('400'))
            triangle.attr('transform', `rotate(-90) translate(0, 65) scale(.9 4)`);
            triangle.attr('fill', 'gray').style('opacity', 0.3);
            let text = d3.select(n[i]).selectAll('text').data(d=> [d]).join('text').text(b.clade);
            text.attr('transform', 'translate(55, 5)');
        }
    });
    branchNodes.select('circle').attr('fill', 'red').attr('r', 4.5);
    branchNodes.on('click', (d, i, n)=> {
        if(d.children == null){
            uncollapseSub(d);
        }else{
            collapseSub(d);
        }
        let lengthBool = d3.select('button#length').text() === 'Hide Lengths';
        updateTree(treenodes, dimensions, treeSvg, g, attrDraw, "SVL");
        //treenodes, dimensions, treeSvg, g, att, pheno
      
    });

    node.raise();
    node.selectAll('circle').raise();

    if(uncollapse){
       
        // let groups = chosenCladesGroup[chosenCladesGroup.length - 1];
        
        // let groupGroup = treeSvg.selectAll('.clade-rects')
        // .data(groups.groups)
        // .join('g')
        // .attr('class', d=> d.label)
        // .classed('clade-rects', true)
    
        // let rect = groupGroup.append('rect');
        // rect.attr('width', 20);
        // rect.attr('height', (d, i)=> {
        //     return d.paths.length * 6;
        // });
        // groupGroup.each((d, i, node)=> {
       
        //     let first = d.paths.map(m=> m[m.length-1].node);
        //     let test = treeSvg.selectAll('.node--leaf').filter((f)=> {
        //         return first.indexOf(f.data.node) > -1});
        //     let leafSort = test.data().sort((a, b)=> {
        //         return a.x - b.x;
        //     });

        //     let chosenNode = test.filter(f=> {
        //         return f.data.node === leafSort[leafSort.length - 1].data.node;
        //     });

     
        //     d3.select(node[i]).attr('transform', `translate(300, ${yScale(leafSort[0].position)})`)
        // })

    }

    return node;
}