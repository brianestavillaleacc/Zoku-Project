/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/ui/serverWidget', 'N/file', 'N/record', 'N/search', "../Library/zk_xm_library"],
    function (serverWidget, file, record, search, libhelper) {

        function onRequest(context) {
            try {
                if (context.request.parameters.sltype == 'template') {
                    var stHtml = getTemplate(context.request.parameters.remqty);
                    log.debug('html', stHtml);
                    context.response.write(stHtml);

                } else {
                    log.debug('context post', context);
                    var recId = updateLeftovers(context, context.request.parameters.remqty);
                    context.response.write(JSON.stringify({code: 200, recordid: recId}));
                }
            } catch (e) {
                log.error('error:', e);
            }

        }

        function getTemplate(inRemainderQty) {
            var stHtml = '<table><tr><td><div>';
            stHtml += '<p>Additional Quantity: <input id="custpage_inputdialog" rows="5" cols="40" style="text-align:right" placeholder="Enter the number here..."/></p>';
            stHtml += '</div></td><td><div>';
            stHtml += '<p>Remaining: <input id="custpage_remainder" rows="5" cols="40" style="text-align:right" value="' + inRemainderQty + '"/></p>';
            stHtml += '</div></td></tr></table><table><tr>';
            stHtml += '<td><div class="uir-message-buttons" class="custombtn"><button value="true" id="btnSubmitOk">Ok</button></div></td>';
            stHtml += '<td><div class="uir-message-buttons" class="custombtn"><button value="false" id="btnSubmitCancel">Cancel</button></div></td></tr></table>';
            return stHtml;

            /*file.load({
                id: 'SuiteScripts/XM Studios Allocation/Library/zk_additional_quantity_dialog.html'
            }).getContents();*/
        }

        function updateLeftovers(context, inRemainderQty) {

            var requestContext = context.request;
            var inRec = requestContext.parameters['rec_id'];
            var inRecType = requestContext.parameters['rec_type'];
            var stAdditionalQuantity = requestContext.parameters['additional'];

            if (inRec) {
                var srAllocRecord = search.lookupFields({
                    type: inRecType,
                    id: inRec,
                    columns: [libhelper.PRODUCT_ALLOCATION_RECORD.LEFTOVERS,libhelper.PRODUCT_ALLOCATION_RECORD.ORDERED_QTY,libhelper.PRODUCT_ALLOCATION_RECORD.ITEM]
                });

                var itemid = srAllocRecord[libhelper.PRODUCT_ALLOCATION_RECORD.ITEM][0].value;
                var objItemDetails = getItemDetails(itemid);
                var objProductAllocations = getProductAllocations(itemid);
                var intRemainderQuantity = calculateRemainder(objItemDetails, objProductAllocations);

                if(stAdditionalQuantity <= intRemainderQuantity) {
                    var objValues = {};
                    if (stAdditionalQuantity > 0) {
                        objValues[libhelper.PRODUCT_ALLOCATION_RECORD.STATUS] = libhelper.allocationStatus.PENDING
                    }

                    srAllocRecord[libhelper.PRODUCT_ALLOCATION_RECORD.LEFTOVERS] = srAllocRecord[libhelper.PRODUCT_ALLOCATION_RECORD.LEFTOVERS] != '' ? srAllocRecord['custrecord_zk_pa_leftovers'] : 0;
                    stAdditionalQuantity = parseInt(stAdditionalQuantity) + parseInt(srAllocRecord[libhelper.PRODUCT_ALLOCATION_RECORD.LEFTOVERS]);
                    objValues[libhelper.PRODUCT_ALLOCATION_RECORD.LEFTOVERS] = stAdditionalQuantity;
                    objValues[libhelper.PRODUCT_ALLOCATION_RECORD.ALLOCATED_QTY] = stAdditionalQuantity+parseInt(srAllocRecord[libhelper.PRODUCT_ALLOCATION_RECORD.ORDERED_QTY]);

                    return record.submitFields({
                        type: inRecType,
                        id: inRec,
                        values: objValues
                    });
                }
            }
        }

        function getItemDetails(intItem) {
            var lookupFieldItem = search.lookupFields({
                type: search.Type.ITEM,
                id: intItem,
                columns: ['custitem_zk_available_manufacture_qty', 'custitem_zk_estimated_manufacture_qty','custitem_zk_distributor_pool']
            });
            return {
                'custitem_zk_distributor_pool': lookupFieldItem['custitem_zk_distributor_pool'] || 0,
                'custitem_zk_available_manufacture_qty':lookupFieldItem['custitem_zk_available_manufacture_qty'] || 0,
                'custitem_zk_estimated_manufacture_qty':lookupFieldItem['custitem_zk_estimated_manufacture_qty'] || 0
            };
        }

        function getProductAllocations(intItem) {
            var objData = {};
            if (intItem == "") {
                return objData;
            }
            var filters = [
                ["custrecord_zk_pa_item", "is", intItem], "AND",
                ["custrecord_zk_pa_status", "noneof", "3"]
            ];
            var itemSearchObj = search.create({
                type: "customrecord_zk_product_allocation",
                filters: filters,
                columns: [
                    search.createColumn({name: "custrecord_zk_pa_allocated_quantity"}),
                    search.createColumn({name: "custrecord_zk_pa_status"}),
                    search.createColumn({name: "custrecord_zk_pa_leftovers"}),
                    search.createColumn({name: "custentity_xm_custinternaldistributor", join: "custrecord_zk_pa_distributor" })
                ]
            });
            var searchResultCount = itemSearchObj.runPaged().count;
            if (searchResultCount != 0) {
                itemSearchObj.run().each(function (result) {
                    if (objData[result.id] == null) {
                        objData[result.id] = {};
                    }
                    objData[result.id] = {
                        'custrecord_zk_pa_allocated_quantity': result.getValue('custrecord_zk_pa_allocated_quantity') || 0,
                        'custrecord_zk_pa_status': result.getText('custrecord_zk_pa_status'),
                        'custrecord_zk_pa_leftovers': result.getValue('custrecord_zk_pa_leftovers'),
                        'isInternalDistributor': result.getValue({
                            name: "custentity_xm_custinternaldistributor",
                            join: "custrecord_zk_pa_distributor"
                        })
                    };
                    return true;
                });
            }
            return objData;
        }


        function calculateRemainder(objItemDetails, objProductAllocations) {
            var flTotalAllocated = 0;
            var flTotalDeductions = 0;
            var intDistributorPool= objItemDetails.custitem_zk_distributor_pool;
            for (var intIndex in objProductAllocations) {
                flTotalAllocated += parseFloat(objProductAllocations[intIndex].custrecord_zk_pa_allocated_quantity || 0);
            }

            flTotalDeductions = parseFloat(flTotalAllocated + parseFloat(intDistributorPool));
            return parseFloat(objItemDetails.custitem_zk_estimated_manufacture_qty - flTotalDeductions);
        }

        return {onRequest: onRequest};
    });