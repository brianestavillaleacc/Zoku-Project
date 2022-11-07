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
                    columns: [libhelper.PRODUCT_ALLOCATION_RECORD.LEFTOVERS,libhelper.PRODUCT_ALLOCATION_RECORD.ORDERED_QTY]
                });
                var objValues = {};
                if (stAdditionalQuantity > 0) {
                    objValues[libhelper.PRODUCT_ALLOCATION_RECORD.STATUS] = libhelper.allocationStatus.PENDING
                }

                srAllocRecord[libhelper.PRODUCT_ALLOCATION_RECORD.LEFTOVERS] = srAllocRecord[libhelper.PRODUCT_ALLOCATION_RECORD.LEFTOVERS] != '' ? srAllocRecord['custrecord_zk_pa_leftovers'] : 0;

                stAdditionalQuantity = parseInt(stAdditionalQuantity) + parseInt(srAllocRecord[libhelper.PRODUCT_ALLOCATION_RECORD.LEFTOVERS])

                objValues[libhelper.PRODUCT_ALLOCATION_RECORD.LEFTOVERS] = stAdditionalQuantity;//libhelper.PRODUCT_ALLOCATION_RECORD.LEFTOVERS
                objValues[libhelper.PRODUCT_ALLOCATION_RECORD.ALLOCATED_QTY] = stAdditionalQuantity+parseInt(srAllocRecord[libhelper.PRODUCT_ALLOCATION_RECORD.ORDERED_QTY]);

                return record.submitFields({
                    type: inRecType,
                    id: inRec,
                    values: objValues
                });
            }
        }


        return {onRequest: onRequest};
    });