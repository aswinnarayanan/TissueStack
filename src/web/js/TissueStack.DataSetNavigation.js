TissueStack.DataSetNavigation = function() {
	if (TissueStack.phone) {
		return;
	} else if (TissueStack.desktop) {
		this.buildDynaTree();
	} else if (TissueStack.tablet) {
		this.buildTabletMenu();
	}
};

TissueStack.DataSetNavigation.prototype = {
	buildDynaTree : function() {
		var treeData = [];

		if (TissueStack.dataSetStore.getSize() == 0) {
			treeData[0] = {title: "No Data Sets Found", tooltip: "No Data Sets Found"};
		} else {
			var counter = 0;
			for (var dataSetKey in TissueStack.dataSetStore.datasets) {
				var dataSet = TissueStack.dataSetStore.datasets[dataSetKey];
				treeData[counter] = 
					{title: dataSet.local_id + '@' +dataSet.host,
						key: dataSet.id,
						tooltip: (dataSet.description ? "Description: " + dataSet.description : "") 
							+ "\nFile: " + dataSet.filename,
						select: true,
						expand: false
					};
				counter++;
			}
			
		}

		// create dyna tree and bind events 
		 $("#treedataset").dynatree({
		       checkbox: true,
		       selectMode: 2,
		       children: treeData,

		       onActivate: function(node) {

			   },
		       onDeactivate: function(node) {

	           },
		       
		       onSelect: function(select, node) {
		         var selNodes = node.tree.getSelectedNodes();
		         var selKeys = $.map(selNodes, function(node){
		              return "[" + node.data.key + "]: '" + node.data.title + "'";
		         });
		         
		         //CONTROL CROSS SHOW/HIDE
		         var selected = node.isSelected();
		         if(node.data.key == "cross_tree_id" && selected == false){
		         	$("#canvas_y_plane_cross_overlay").fadeOut(50);
		         }else if(node.data.key == "cross_tree_id" && selected == true){
		         	$("#canvas_y_plane_cross_overlay").fadeIn(50);
		         }
		         //END
		         	         
		       },
		       onClick: function(node, event) {
		         if( node.getEventTargetType(event) == "title" )
		           node.toggleSelect();
		       },
		       onKeydown: function(node, event) {
		         if( event.which == 32 ) {
		           node.toggleSelect();
		           return false;
		         }
		       },
		       onDblClick: function(node, event) {
		         node.toggleSelect();
		       },
		  });
	},
	buildTabletMenu : function() {
		// TODO: implement
	}
};
