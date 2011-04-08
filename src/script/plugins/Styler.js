/**
 * Copyright (c) 2008-2011 The Open Planning Project
 * 
 * Published under the BSD license.
 * See https://github.com/opengeo/gxp/raw/master/license.txt for the full text
 * of the license.
 */

/**
 * @requires plugins/Tool.js
 * @requires widgets/WMSStylesDialog.js
 */

/** api: (define)
 *  module = gxp.plugins
 *  class = Styler
 */

/** api: (extends)
 *  plugins/Tool.js
 */
Ext.namespace("gxp.plugins");

/** api: constructor
 *  .. class:: Styler(config)
 *
 *    Plugin providing a styles editing dialog for geoserver layers.
 */
gxp.plugins.Styler = Ext.extend(gxp.plugins.Tool, {
    
    /** api: ptype = gxp_styler */
    ptype: "gxp_styler",
    
    /** api: config[menuText]
     *  ``String``
     *  Text for layer properties menu item (i18n).
     */
    menuText: "Edit Styles",

    /** api: config[tooltip]
     *  ``String``
     *  Text for layer properties action tooltip (i18n).
     */
    tooltip: "Manage layer styles",
    
    /** api: config[sameOriginStyling]
     *  ``Boolean``
     *  Only allow editing of styles for layers whose sources have a URL that
     *  matches the origin of this applicaiton.  It is strongly discouraged to 
     *  do styling through commonly used proxies as all authorization headers
     *  and cookies are shared with all remote sources.  Default is ``true``.
     */
    sameOriginStyling: true,
    
    /** api: config[rasterStyling]
     *  ``Boolean`` If set to true, single-band raster styling will be
     *  supported. Default is ``false``.
     */
    rasterStyling: false,
    
    constructor: function(config) {
        gxp.plugins.Styler.superclass.constructor.apply(this, arguments);
        
        if (!this.outputConfig) {
            this.outputConfig = {
                autoHeight: true,
                width: 265
            };
        }
        Ext.applyIf(this.outputConfig, {
            closeAction: "close"
        });
    },
    
    /** api: method[addActions]
     */
    addActions: function() {
        var layerProperties;
        var actions = gxp.plugins.Styler.superclass.addActions.apply(this, [{
            menuText: this.menuText,
            iconCls: "gxp-icon-palette",
            disabled: true,
            tooltip: this.tooltip,
            handler: function() {
                this.addOutput();
            },
            scope: this
        }]);
        
        this.launchAction = actions[0];
        this.target.on({
            layerselectionchange: this.handleLayerChange,
            scope: this
        });
        
        return actions;
    },
    
    /** private: method[handleLayerChange]
     *  :arg record: ``GeoExt.data.LayerRecord``
     *
     *  Handle changes to the target viewer's selected layer.
     */
    handleLayerChange: function(record) {
        this.launchAction.disable();
        this.targetLayerRecord = record;
        var source = this.target.getSource(record);
        if (source instanceof gxp.plugins.WMSSource) {
            source.describeLayer(record, this.checkIfStyleable, this);
        }
    },
            
    /** private: method[checkIfStyleable]
     *  :arg record: ``GeoExt.data.LayerRecord``
     *
     *  Determine if a particular layer can be styled and decide whether to 
     *  enable the launch action.
     */
    checkIfStyleable: function(rec) {
        var editableStyles = false;
        var record = this.targetLayerRecord; // TODO: this may have changed while waiting for describeLayer
        var owsTypes = ["WFS"];
        if (this.rasterStyling === true) {
            owsTypes.push("WCS");
        }
        if (rec && owsTypes.indexOf(rec.get("owsType")) !== -1) {
            if (record && record.get("styles")) {
                var source = this.target.layerSources[record.get("source")];
                var url = source.url.split(
                    "?").shift().replace(/\/(wms|ows)\/?$/, "/rest");
                if (this.sameOriginStyling) {
                    // this could be made more robust
                    // for now, only style for sources with relative url
                    editableStyles = url.charAt(0) === "/";
                } else {
                    editableStyles = true;
                }
                if (editableStyles) {
                    var authorized = this.target.isAuthorized();
                    if (typeof authorized == "boolean") {
                        this.launchAction.setDisabled(!authorized);
                    } else {
                        Ext.Ajax.request({
                            method: "PUT",
                            url: url + "/styles",
                            callback: function(options, success, response) {
                                // we expect a 405 error code here if we are dealing
                                // with GeoServer and have write access.
                                this.launchAction.setDisabled(response.status != 405);                        
                            }
                        });
                    }
                }
            }
        }
    },
    
    addOutput: function(config) {
        config = config || {};
        var record = this.target.selectedLayer;

        var origCfg = this.initialConfig.outputConfig || {};
        this.outputConfig.title = origCfg.title ||
            this.menuText + ": " + record.get("title");

        Ext.apply(config, gxp.WMSStylesDialog.createGeoServerStylerConfig(record));
        if (this.rasterStyling === true) {
            config.plugins.push({
                ptype: "gxp_wmsrasterstylesdialog"
            });
        }
        Ext.applyIf(config, {style: "padding: 10px"});
        
        var output = gxp.plugins.Styler.superclass.addOutput.call(this, config);
        output.stylesStore.on("load", function() {
            this.outputTarget || output.ownerCt.ownerCt.center();
        });
    }
        
});

Ext.preg(gxp.plugins.Styler.prototype.ptype, gxp.plugins.Styler);
